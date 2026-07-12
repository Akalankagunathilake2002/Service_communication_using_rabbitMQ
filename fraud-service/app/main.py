import asyncio
import json
import time
from collections import defaultdict, deque

import aio_pika

from app.model import RISK_FLAG_THRESHOLD, extract_features, predict_risk
from app.rabbitmq import RABBITMQ_URL, connect_with_retry, get_exchange

QUEUE_NAME = "fraud_service.order_created"
ROUTING_KEY = "order.created"
VELOCITY_WINDOW_SECONDS = 120

# Recent order timestamps per customer, used as a fraud-velocity signal.
# Unbounded/in-memory like every other piece of state in this system - fine for a demo,
# bounded in practice by the number of distinct customer names typed during a session.
_recent_orders: dict[str, deque] = defaultdict(deque)


def _record_and_count_velocity(customer: str) -> int:
    now = time.monotonic()
    history = _recent_orders[customer]
    while history and now - history[0] > VELOCITY_WINDOW_SECONDS:
        history.popleft()
    velocity = len(history)
    history.append(now)
    return velocity


async def handle_order_created(exchange: aio_pika.Exchange, message: aio_pika.IncomingMessage) -> None:
    async with message.process():
        order = json.loads(message.body)
        order_id = order["order_id"]
        customer = order.get("customer") or "unknown"

        velocity = _record_and_count_velocity(customer)
        features = extract_features(order, velocity)
        risk_score = round(predict_risk(features), 3)
        flag = risk_score >= RISK_FLAG_THRESHOLD

        print(f"[fraud-service] order_id={order_id} risk={risk_score:.3f} flag={flag}")

        await exchange.publish(
            aio_pika.Message(
                body=json.dumps({"order_id": order_id, "risk_score": risk_score, "flag": flag}).encode(),
                content_type="application/json",
                delivery_mode=aio_pika.DeliveryMode.PERSISTENT,
            ),
            routing_key="order.fraud_checked",
        )


async def main() -> None:
    connection = await connect_with_retry(RABBITMQ_URL)
    channel = await connection.channel()
    await channel.set_qos(prefetch_count=10)

    exchange = await get_exchange(channel)
    queue = await channel.declare_queue(QUEUE_NAME, durable=True)
    await queue.bind(exchange, routing_key=ROUTING_KEY)

    print(f"[fraud-service] waiting for '{ROUTING_KEY}' events on queue '{QUEUE_NAME}'")

    await queue.consume(lambda message: handle_order_created(exchange, message))
    await asyncio.Future()  # run forever


if __name__ == "__main__":
    asyncio.run(main())
