"use client";

import { useEffect, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { DASHBOARD_API_URL } from "@/lib/config";
import type { Topology } from "@/lib/types";

const QUEUE_COLOR: Record<string, string> = {
  "inventory_service.order_created": "var(--series-1)",
  "notification_service.order_events": "var(--series-2)",
  "dashboard_service.all_events": "var(--series-3)",
  "fraud_service.order_created": "var(--series-4)",
};

const QUEUE_LABEL: Record<string, string> = {
  "inventory_service.order_created": "inventory-service",
  "notification_service.order_events": "notification-service",
  "dashboard_service.all_events": "dashboard-service",
  "fraud_service.order_created": "fraud-service",
};

function ChartTooltip({ active, payload }: { active?: boolean; payload?: { payload: { name: string; value: number } }[] }) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  return (
    <div
      className="rounded border px-2 py-1 text-xs shadow-sm"
      style={{ borderColor: "var(--border)", background: "var(--surface-1)", color: "var(--text-primary)" }}
    >
      {p.name}: <strong>{p.value}</strong> ready
    </div>
  );
}

export default function TopologyView() {
  const [topology, setTopology] = useState<Topology | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function poll() {
      try {
        const res = await fetch(`${DASHBOARD_API_URL}/api/topology`);
        if (!res.ok) throw new Error();
        const data = (await res.json()) as Topology;
        if (!cancelled) {
          setTopology(data);
          setError(false);
        }
      } catch {
        if (!cancelled) setError(true);
      }
    }

    poll();
    const interval = setInterval(poll, 3000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  const queueData =
    topology?.queues.map((q) => ({
      key: q.name,
      name: QUEUE_LABEL[q.name] ?? q.name,
      value: q.messages_ready,
      consumers: q.consumers,
    })) ?? [];

  return (
    <div
      className="rounded-lg border p-5"
      style={{ borderColor: "var(--border)", background: "var(--surface-1)" }}
    >
      <div className="mb-1 flex items-center justify-between">
        <h2 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
          RabbitMQ topology
        </h2>
        {error && (
          <span className="text-xs" style={{ color: "var(--status-critical)" }}>
            unreachable
          </span>
        )}
      </div>
      <p className="mb-4 text-xs" style={{ color: "var(--text-muted)" }}>
        exchange <strong style={{ color: "var(--text-secondary)" }}>{topology?.exchange ?? "ecommerce"}</strong> (
        {topology?.exchange_type ?? "topic"}) — live queue depth, polled every 3s
      </p>

      <div className="mb-4 h-36">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={queueData} layout="vertical" barCategoryGap="25%">
            <CartesianGrid horizontal={false} stroke="var(--gridline)" />
            <XAxis type="number" allowDecimals={false} tick={{ fill: "var(--text-muted)", fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis
              type="category"
              dataKey="name"
              tick={{ fill: "var(--text-secondary)", fontSize: 11 }}
              axisLine={{ stroke: "var(--baseline)" }}
              tickLine={false}
              width={110}
            />
            <Tooltip content={<ChartTooltip />} cursor={{ fill: "var(--gridline)" }} />
            <Bar dataKey="value" radius={[0, 4, 4, 0]} maxBarSize={20}>
              {queueData.map((q) => (
                <Cell key={q.key} fill={QUEUE_COLOR[q.key] ?? "var(--series-4)"} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <p className="mb-2 text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
        Bindings (routing key → queue)
      </p>
      <ul className="space-y-1">
        {(topology?.bindings ?? []).map((b, i) => (
          <li key={i} className="flex items-center gap-2 text-xs" style={{ color: "var(--text-secondary)" }}>
            <code className="rounded px-1" style={{ background: "var(--gridline)", color: "var(--text-primary)" }}>
              {b.routing_key}
            </code>
            <span style={{ color: "var(--text-muted)" }}>→</span>
            {QUEUE_LABEL[b.destination] ?? b.destination}
          </li>
        ))}
        {!topology && (
          <li className="text-xs" style={{ color: "var(--text-muted)" }}>
            Loading topology…
          </li>
        )}
      </ul>
    </div>
  );
}
