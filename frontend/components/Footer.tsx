const STACK = ["Next.js", "FastAPI", "RabbitMQ", "Docker Compose", "Recharts"];

const SERVICES = [
  { name: "order-service", port: 8001 },
  { name: "dashboard-service", port: 8002 },
  { name: "RabbitMQ management", port: 15672 },
];

export default function Footer() {
  return (
    <footer className="border-t" style={{ borderColor: "var(--border)" }}>
      <div className="mx-auto max-w-6xl px-6 py-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
              Built with
            </p>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {STACK.map((item) => (
                <span
                  key={item}
                  className="rounded-full border px-2 py-0.5 text-xs"
                  style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}
                >
                  {item}
                </span>
              ))}
            </div>
          </div>

          <div>
            <p className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
              Endpoints
            </p>
            <ul className="mt-1.5 space-y-1">
              {SERVICES.map((s) => (
                <li key={s.name} className="text-xs" style={{ color: "var(--text-muted)" }}>
                  <a
                    href={`http://localhost:${s.port}`}
                    target="_blank"
                    rel="noreferrer"
                    className="hover:underline"
                    style={{ color: "var(--text-secondary)" }}
                  >
                    localhost:{s.port}
                  </a>{" "}
                  — {s.name}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <p className="mt-6 text-xs" style={{ color: "var(--text-muted)" }}>
          All services communicate only through the <code>ecommerce</code> topic exchange — no
          service calls another directly.
        </p>
      </div>
    </footer>
  );
}
