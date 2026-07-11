import asyncio
from collections import defaultdict
from datetime import datetime, timezone
from typing import Any

STATUS_BY_ROUTING_KEY = {
    "order.created": "created",
    "order.inventory_reserved": "reserved",
    "order.inventory_failed": "failed",
}


class OrderStore:
    def __init__(self) -> None:
        self._orders: dict[str, dict[str, Any]] = {}
        self._subscribers: set[asyncio.Queue] = set()

    def subscribe(self) -> asyncio.Queue:
        queue: asyncio.Queue = asyncio.Queue()
        self._subscribers.add(queue)
        return queue

    def unsubscribe(self, queue: asyncio.Queue) -> None:
        self._subscribers.discard(queue)

    async def _broadcast(self, event: dict[str, Any]) -> None:
        for queue in list(self._subscribers):
            await queue.put(event)

    async def apply_event(self, routing_key: str, payload: dict[str, Any]) -> dict[str, Any]:
        order_id = payload["order_id"]
        now = datetime.now(timezone.utc).isoformat()
        status = STATUS_BY_ROUTING_KEY.get(routing_key, routing_key)

        order = self._orders.setdefault(
            order_id,
            {
                "order_id": order_id,
                "customer": None,
                "items": [],
                "total": None,
                "status": "unknown",
                "reason": None,
                "created_at": now,
                "updated_at": now,
                "history": [],
            },
        )

        if routing_key == "order.created":
            order["customer"] = payload.get("customer")
            order["items"] = payload.get("items", [])
            order["total"] = payload.get("total")
            order["created_at"] = payload.get("created_at", now)

        if routing_key == "order.inventory_failed":
            order["reason"] = payload.get("reason")

        order["status"] = status
        order["updated_at"] = now
        order["history"].append({"routing_key": routing_key, "at": now})

        event = {"routing_key": routing_key, "order": dict(order), "received_at": now}
        await self._broadcast(event)
        return event

    def list_orders(self) -> list[dict[str, Any]]:
        return sorted(self._orders.values(), key=lambda o: o["created_at"], reverse=True)

    def stats(self) -> dict[str, Any]:
        orders = list(self._orders.values())
        by_status: dict[str, int] = defaultdict(int)
        reserved_revenue = 0.0

        for order in orders:
            by_status[order["status"]] += 1
            if order["status"] == "reserved" and order["total"] is not None:
                reserved_revenue += order["total"]

        return {
            "total_orders": len(orders),
            "by_status": dict(by_status),
            "reserved_revenue": round(reserved_revenue, 2),
        }


store = OrderStore()
