import asyncio
import json
import random

import aio_pika

from app.rabbitmq import RABBITMQ_URL, connect_with_retry, get_exchange

QUEUE_NAME = "inventory_service.order_created"
ROUTING_KEY = "order.created"


async def handle_order_created(exchange: aio_pika.Exchange, message: aio_pika.IncomingMessage) -> None:
    async with message.process():
        order = json.loads(message.body)
        order_id = order["order_id"]

        # Simulate a stock check: ~85% of orders can be fulfilled.
        in_stock = random.random() < 0.85

        if in_stock:
            routing_key = "order.inventory_reserved"
            reply = {"order_id": order_id, "status": "reserved"}
            print(f"[inventory-service] order_id={order_id} RESERVED")
        else:
            routing_key = "order.inventory_failed"
            reply = {"order_id": order_id, "status": "failed", "reason": "out_of_stock"}
            print(f"[inventory-service] order_id={order_id} FAILED (out_of_stock)")

        await exchange.publish(
            aio_pika.Message(
                body=json.dumps(reply).encode(),
                content_type="application/json",
                delivery_mode=aio_pika.DeliveryMode.PERSISTENT,
            ),
            routing_key=routing_key,
        )


async def main() -> None:
    connection = await connect_with_retry(RABBITMQ_URL)
    channel = await connection.channel()
    await channel.set_qos(prefetch_count=10)

    exchange = await get_exchange(channel)
    queue = await channel.declare_queue(QUEUE_NAME, durable=True)
    await queue.bind(exchange, routing_key=ROUTING_KEY)

    print(f"[inventory-service] waiting for '{ROUTING_KEY}' events on queue '{QUEUE_NAME}'")

    await queue.consume(lambda message: handle_order_created(exchange, message))
    await asyncio.Future()  # run forever


if __name__ == "__main__":
    asyncio.run(main())
