import asyncio
import os

import aio_pika
from aio_pika import ExchangeType

RABBITMQ_URL = os.getenv("RABBITMQ_URL", "amqp://guest:guest@localhost:5672/")
RABBITMQ_MANAGEMENT_URL = os.getenv("RABBITMQ_MANAGEMENT_URL", "http://guest:guest@localhost:15672/api")
EXCHANGE_NAME = "ecommerce"


async def connect_with_retry(url: str, attempts: int = 10, delay: float = 2.0) -> aio_pika.RobustConnection:
    last_error: Exception | None = None
    for attempt in range(1, attempts + 1):
        try:
            return await aio_pika.connect_robust(url)
        except (ConnectionError, OSError) as exc:
            last_error = exc
            print(f"[rabbitmq] connection attempt {attempt}/{attempts} failed: {exc}")
            await asyncio.sleep(delay)
    raise RuntimeError(f"Could not connect to RabbitMQ after {attempts} attempts") from last_error


async def get_exchange(channel: aio_pika.Channel) -> aio_pika.Exchange:
    return await channel.declare_exchange(EXCHANGE_NAME, ExchangeType.TOPIC, durable=True)
