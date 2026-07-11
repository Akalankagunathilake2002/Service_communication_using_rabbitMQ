"use client";

import { DASHBOARD_API_URL, ORDER_API_URL } from "@/lib/config";

const LINKS = [
  { label: "order-service docs", href: `${ORDER_API_URL}/docs` },
  { label: "dashboard-service docs", href: `${DASHBOARD_API_URL}/docs` },
  { label: "RabbitMQ management", href: "http://localhost:15672" },
];

export default function Header({ connected }: { connected: boolean }) {
  return (
    <header
      className="sticky top-0 z-10 border-b"
      style={{ borderColor: "var(--border)", background: "var(--surface-1)" }}
    >
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
        <div className="flex items-center gap-2.5">
          <span
            className="flex h-7 w-7 items-center justify-center rounded-md text-xs font-bold text-white"
            style={{ background: "var(--series-1)" }}
          >
            RQ
          </span>
          <div>
            <p className="text-sm font-semibold leading-none" style={{ color: "var(--text-primary)" }}>
              Service communication using RabbitMQ
            </p>
            <p className="mt-0.5 text-xs leading-none" style={{ color: "var(--text-muted)" }}>
              order-service → topic exchange → inventory / notification / dashboard
            </p>
          </div>
        </div>

        <div className="flex items-center gap-5">
          <nav className="hidden gap-4 sm:flex">
            {LINKS.map((link) => (
              <a
                key={link.href}
                href={link.href}
                target="_blank"
                rel="noreferrer"
                className="text-xs underline-offset-2 hover:underline"
                style={{ color: "var(--text-secondary)" }}
              >
                {link.label} ↗
              </a>
            ))}
          </nav>
          <span className="flex items-center gap-1.5 text-xs" style={{ color: "var(--text-muted)" }}>
            <span
              className="inline-block h-2 w-2 rounded-full"
              style={{ background: connected ? "var(--status-good)" : "var(--status-critical)" }}
            />
            {connected ? "live" : "reconnecting…"}
          </span>
        </div>
      </div>
    </header>
  );
}
