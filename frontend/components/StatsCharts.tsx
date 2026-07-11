"use client";

import { useMemo } from "react";
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
import type { Order, OrderStatus } from "@/lib/types";

const STATUS_META: Record<OrderStatus, { label: string; color: string }> = {
  created: { label: "Created", color: "var(--status-warning)" },
  reserved: { label: "Reserved", color: "var(--status-good)" },
  failed: { label: "Failed", color: "var(--status-critical)" },
  unknown: { label: "Unknown", color: "var(--text-muted)" },
};

function ChartTooltip({ active, payload }: { active?: boolean; payload?: { name: string; value: number }[] }) {
  if (!active || !payload?.length) return null;
  return (
    <div
      className="rounded border px-2 py-1 text-xs shadow-sm"
      style={{ borderColor: "var(--border)", background: "var(--surface-1)", color: "var(--text-primary)" }}
    >
      {payload[0].name}: <strong>{payload[0].value}</strong>
    </div>
  );
}

export default function StatsCharts({ orders }: { orders: Order[] }) {
  const statusData = useMemo(() => {
    const counts: Record<string, number> = { created: 0, reserved: 0, failed: 0 };
    for (const order of orders) {
      counts[order.status] = (counts[order.status] ?? 0) + 1;
    }
    return (["created", "reserved", "failed"] as OrderStatus[]).map((status) => ({
      status,
      name: STATUS_META[status].label,
      value: counts[status] ?? 0,
    }));
  }, [orders]);

  const timeseries = useMemo(() => {
    const buckets = new Map<string, number>();
    for (const order of orders) {
      const d = new Date(order.created_at);
      const key = d.toLocaleTimeString(undefined, { hour12: false, hour: "2-digit", minute: "2-digit" });
      buckets.set(key, (buckets.get(key) ?? 0) + 1);
    }
    return Array.from(buckets.entries())
      .map(([name, value]) => ({ name, value }))
      .slice(-12);
  }, [orders]);

  const reservedRevenue = useMemo(
    () => orders.filter((o) => o.status === "reserved").reduce((sum, o) => sum + (o.total ?? 0), 0),
    [orders],
  );

  return (
    <div
      className="rounded-lg border p-5"
      style={{ borderColor: "var(--border)", background: "var(--surface-1)" }}
    >
      <h2 className="mb-1 text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
        Order stats
      </h2>
      <p className="mb-4 text-xs" style={{ color: "var(--text-muted)" }}>
        {orders.length} orders total · ${reservedRevenue.toFixed(2)} reserved revenue
      </p>

      <p className="mb-2 text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
        By status
      </p>
      <div className="mb-6 h-40">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={statusData} barCategoryGap="20%">
            <CartesianGrid vertical={false} stroke="var(--gridline)" />
            <XAxis
              dataKey="name"
              tick={{ fill: "var(--text-muted)", fontSize: 11 }}
              axisLine={{ stroke: "var(--baseline)" }}
              tickLine={false}
            />
            <YAxis
              allowDecimals={false}
              tick={{ fill: "var(--text-muted)", fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              width={24}
            />
            <Tooltip content={<ChartTooltip />} cursor={{ fill: "var(--gridline)" }} />
            <Bar dataKey="value" radius={[4, 4, 0, 0]} maxBarSize={48}>
              {statusData.map((entry) => (
                <Cell key={entry.status} fill={STATUS_META[entry.status as OrderStatus].color} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="mb-6 flex gap-4">
        {(["created", "reserved", "failed"] as OrderStatus[]).map((status) => (
          <span key={status} className="flex items-center gap-1.5 text-xs" style={{ color: "var(--text-secondary)" }}>
            <span
              className="inline-block h-2 w-2 rounded-full"
              style={{ background: STATUS_META[status].color }}
            />
            {STATUS_META[status].label}
          </span>
        ))}
      </div>

      <p className="mb-2 text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
        Orders over time
      </p>
      <div className="h-40">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={timeseries} barCategoryGap="15%">
            <CartesianGrid vertical={false} stroke="var(--gridline)" />
            <XAxis
              dataKey="name"
              tick={{ fill: "var(--text-muted)", fontSize: 10 }}
              axisLine={{ stroke: "var(--baseline)" }}
              tickLine={false}
            />
            <YAxis
              allowDecimals={false}
              tick={{ fill: "var(--text-muted)", fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              width={24}
            />
            <Tooltip content={<ChartTooltip />} cursor={{ fill: "var(--gridline)" }} />
            <Bar dataKey="value" fill="var(--series-1)" radius={[4, 4, 0, 0]} maxBarSize={32} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
