"use client";

import { useEffect, useRef, useState } from "react";
import { DASHBOARD_API_URL, DASHBOARD_WS_URL } from "@/lib/config";
import type { DashboardEvent, Order } from "@/lib/types";

const MAX_EVENTS = 50;

export function useDashboardData() {
  const [orders, setOrders] = useState<Record<string, Order>>({});
  const [events, setEvents] = useState<DashboardEvent[]>([]);
  const [connected, setConnected] = useState(false);
  const ordersRef = useRef(orders);
  ordersRef.current = orders;

  useEffect(() => {
    let cancelled = false;

    fetch(`${DASHBOARD_API_URL}/api/orders`)
      .then((res) => res.json())
      .then((list: Order[]) => {
        if (cancelled) return;
        const map: Record<string, Order> = {};
        for (const order of list) map[order.order_id] = order;
        setOrders(map);
      })
      .catch(() => {
        /* dashboard-service not reachable yet; websocket will backfill on reconnect */
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let ws: WebSocket | null = null;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    let cancelled = false;

    function connect() {
      ws = new WebSocket(DASHBOARD_WS_URL);

      ws.onopen = () => setConnected(true);

      ws.onmessage = (msg) => {
        const event = JSON.parse(msg.data) as DashboardEvent;
        setOrders((prev) => ({ ...prev, [event.order.order_id]: event.order }));
        setEvents((prev) => [event, ...prev].slice(0, MAX_EVENTS));
      };

      ws.onclose = () => {
        setConnected(false);
        if (!cancelled) retryTimer = setTimeout(connect, 2000);
      };

      ws.onerror = () => ws?.close();
    }

    connect();

    return () => {
      cancelled = true;
      if (retryTimer) clearTimeout(retryTimer);
      ws?.close();
    };
  }, []);

  const orderList = Object.values(orders).sort((a, b) => (a.created_at < b.created_at ? 1 : -1));

  return { orders: orderList, events, connected };
}
