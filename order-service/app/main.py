import json
import uuid
from contextlib import asynccontextmanager
from datetime import datetime, timezone

import aio_pika
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from app.rabbitmq import RABBITMQ_URL, connect_with_retry, get_exchange

state: dict = {}


@asynccontextmanager
async def lifespan(app: FastAPI):
    connection = await connect_with_retry(RABBITMQ_URL)
    channel = await connection.channel()
    exchange = await get_exchange(channel)
    state["connection"] = connection
    state["exchange"] = exchange
    print("[order-service] connected to RabbitMQ, exchange declared")
    yield
    await connection.close()


app = FastAPI(title="order-service", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


class OrderItem(BaseModel):
    sku: str
    qty: int
    price: float


class OrderRequest(BaseModel):
    customer: str
    items: list[OrderItem]


@app.post("/orders")
async def create_order(order: OrderRequest):
    order_id = str(uuid.uuid4())
    total = sum(item.qty * item.price for item in order.items)

    payload = {
        "order_id": order_id,
        "customer": order.customer,
        "items": [item.model_dump() for item in order.items],
        "total": total,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }

    exchange: aio_pika.Exchange = state["exchange"]
    await exchange.publish(
        aio_pika.Message(
            body=json.dumps(payload).encode(),
            content_type="application/json",
            delivery_mode=aio_pika.DeliveryMode.PERSISTENT,
        ),
        routing_key="order.created",
    )

    print(f"[order-service] published order.created for order_id={order_id}")
    return {"order_id": order_id, "status": "created", "total": total}


@app.get("/health")
async def health():
    return {"status": "ok"}
