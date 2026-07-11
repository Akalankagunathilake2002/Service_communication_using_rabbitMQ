import asyncio
import json
from contextlib import asynccontextmanager

import aio_pika
import httpx
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

from app.rabbitmq import (
    EXCHANGE_NAME,
    RABBITMQ_MANAGEMENT_URL,
    RABBITMQ_URL,
    connect_with_retry,
    get_exchange,
)
from app.store import store

QUEUE_NAME = "dashboard_service.all_events"
ROUTING_KEY = "#"  # every event on the exchange, regardless of namespace

KNOWN_QUEUES = [
    "inventory_service.order_created",
    "notification_service.order_events",
    "dashboard_service.all_events",
]

state: dict = {}


async def handle_event(message: aio_pika.IncomingMessage) -> None:
    async with message.process():
        payload = json.loads(message.body)
        event = await store.apply_event(message.routing_key, payload)
        print(f"[dashboard-service] ({message.routing_key}) order_id={event['order']['order_id']}")


async def consume_forever(connection: aio_pika.RobustConnection) -> None:
    channel = await connection.channel()
    await channel.set_qos(prefetch_count=20)
    exchange = await get_exchange(channel)
    queue = await channel.declare_queue(QUEUE_NAME, durable=True)
    await queue.bind(exchange, routing_key=ROUTING_KEY)
    print(f"[dashboard-service] waiting for '{ROUTING_KEY}' events on queue '{QUEUE_NAME}'")
    await queue.consume(handle_event)
    await asyncio.Future()  # run forever


@asynccontextmanager
async def lifespan(app: FastAPI):
    connection = await connect_with_retry(RABBITMQ_URL)
    state["connection"] = connection
    state["consumer_task"] = asyncio.create_task(consume_forever(connection))
    yield
    state["consumer_task"].cancel()
    await connection.close()


app = FastAPI(title="dashboard-service", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/orders")
async def get_orders():
    return store.list_orders()


@app.get("/api/stats")
async def get_stats():
    return store.stats()


@app.get("/api/topology")
async def get_topology():
    async with httpx.AsyncClient(base_url=RABBITMQ_MANAGEMENT_URL, timeout=5.0) as client:
        bindings_resp = await client.get(f"/exchanges/%2F/{EXCHANGE_NAME}/bindings/source")
        queues_resp = await client.get("/queues/%2F")

    bindings = [
        {"routing_key": b["routing_key"], "destination": b["destination"]}
        for b in bindings_resp.json()
        if b.get("routing_key")
    ]

    all_queues = {q["name"]: q for q in queues_resp.json()}
    queues = [
        {
            "name": name,
            "messages_ready": all_queues[name].get("messages_ready", 0),
            "messages_unacknowledged": all_queues[name].get("messages_unacknowledged", 0),
            "consumers": all_queues[name].get("consumers", 0),
        }
        for name in KNOWN_QUEUES
        if name in all_queues
    ]

    return {"exchange": EXCHANGE_NAME, "exchange_type": "topic", "bindings": bindings, "queues": queues}


@app.get("/health")
async def health():
    return {"status": "ok"}


@app.websocket("/ws")
async def ws_events(websocket: WebSocket):
    await websocket.accept()
    queue = store.subscribe()
    try:
        while True:
            event = await queue.get()
            await websocket.send_json(event)
    except WebSocketDisconnect:
        pass
    finally:
        store.unsubscribe(queue)
