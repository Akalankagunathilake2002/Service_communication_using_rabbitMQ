"use client";

import type { DashboardEvent } from "@/lib/types";

const LABEL: Record<string, string> = {
  "order.created": "order created",
  "order.inventory_reserved": "inventory reserved",
  "order.inventory_failed": "inventory failed",
};

const DOT_COLOR: Record<string, string> = {
  "order.created": "var(--series-1)",
  "order.inventory_reserved": "var(--status-good)",
  "order.inventory_failed": "var(--status-critical)",
};

function timeOnly(iso: string) {
  return new Date(iso).toLocaleTimeString(undefined, { hour12: false });
}

export default function LiveFeed({ events, connected }: { events: DashboardEvent[]; connected: boolean }) {
  return (
    <div
      className="rounded-lg border p-5"
      style={{ borderColor: "var(--border)", background: "var(--surface-1)" }}
    >
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
          Live event feed
        </h2>
        <span className="flex items-center gap-1.5 text-xs" style={{ color: "var(--text-muted)" }}>
          <span
            className="inline-block h-2 w-2 rounded-full"
            style={{ background: connected ? "var(--status-good)" : "var(--status-critical)" }}
          />
          {connected ? "connected" : "reconnecting…"}
        </span>
      </div>

      <ul className="max-h-80 space-y-2 overflow-y-auto">
        {events.length === 0 && (
          <li className="text-xs" style={{ color: "var(--text-muted)" }}>
            Waiting for events — place an order to see it flow through RabbitMQ.
          </li>
        )}
        {events.map((event, i) => (
          <li key={`${event.order.order_id}-${event.routing_key}-${i}`} className="flex items-start gap-2 text-xs">
            <span
              className="mt-1 inline-block h-2 w-2 shrink-0 rounded-full"
              style={{ background: DOT_COLOR[event.routing_key] ?? "var(--text-muted)" }}
            />
            <span style={{ color: "var(--text-secondary)" }}>
              <span style={{ color: "var(--text-muted)" }}>{timeOnly(event.received_at)}</span>{" "}
              <strong style={{ color: "var(--text-primary)" }}>
                {LABEL[event.routing_key] ?? event.routing_key}
              </strong>{" "}
              — order {event.order.order_id.slice(0, 8)}… ({event.order.customer ?? "unknown"})
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
