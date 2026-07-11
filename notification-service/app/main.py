import asyncio
import json

import aio_pika

from app.rabbitmq import RABBITMQ_URL, connect_with_retry, get_exchange

QUEUE_NAME = "notification_service.order_events"
ROUTING_KEY = "order.#"  # wildcard: every event whose key starts with "order."

MESSAGES = {
    "order.created": lambda e: f"Order {e['order_id']} received from {e['customer']} (total ${e['total']:.2f})",
    "order.inventory_reserved": lambda e: f"Order {e['order_id']}: stock reserved, preparing shipment",
    "order.inventory_failed": lambda e: f"Order {e['order_id']}: out of stock, notifying customer of delay",
}


async def handle_event(message: aio_pika.IncomingMessage) -> None:
    async with message.process():
        event = json.loads(message.body)
        describe = MESSAGES.get(message.routing_key, lambda e: json.dumps(e))
        print(f"[notification-service] ({message.routing_key}) {describe(event)}")


async def main() -> None:
    connection = await connect_with_retry(RABBITMQ_URL)
    channel = await connection.channel()
    await channel.set_qos(prefetch_count=10)

    exchange = await get_exchange(channel)
    queue = await channel.declare_queue(QUEUE_NAME, durable=True)
    await queue.bind(exchange, routing_key=ROUTING_KEY)

    print(f"[notification-service] waiting for '{ROUTING_KEY}' events on queue '{QUEUE_NAME}'")

    await queue.consume(handle_event)
    await asyncio.Future()  # run forever


if __name__ == "__main__":
    asyncio.run(main())
