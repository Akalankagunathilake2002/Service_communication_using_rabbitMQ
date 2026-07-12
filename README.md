# Service Communication using RabbitMQ

A realistic demo of event-driven microservice communication using RabbitMQ (Python backend,
Next.js dashboard).

## Topology

Five backend services talk to each other only through a single **topic exchange** called
`ecommerce`. No service calls another directly (no service-to-service HTTP) — they publish and
subscribe to events, so services can be added, removed, or restarted without the others knowing.
A Next.js frontend visualizes the whole thing live.

```
                         ┌──────────────────┐
  POST /orders  ──────►  │   order-service   │
                         └─────────┬─────────┘
                                   │ publishes "order.created"
                                   ▼
                        ┌────────────────────┐
                        │  exchange: ecommerce │ (type: topic)
                        └──────────┬──────────┘
                                   │ order.created (fan-out) / order.# / #
        ┌──────────────┬───────────┼──────────────┬──────────────────┐
        ▼               ▼                          ▼                  ▼
 ┌─────────────┐ ┌──────────────┐        ┌─────────────────────┐  ┌───────────────────┐
 │inventory-svc │ │ fraud-service │        │ notification-service │  │  dashboard-service │
 │binds:        │ │ binds:        │        │ binds: order.#        │  │  binds: #          │
 │order.created │ │order.created  │        └──────────────────────┘  └─────────┬──────────┘
 └──────┬───────┘ └──────┬────────┘                     ▲                       │ REST + WS
        │ publishes      │ publishes                    │                       ▼
        │ order.inventory│ order.fraud_checked           │              ┌───────────────┐
        │ _reserved/     └───────────────────────────────┘              │ Next.js frontend│
        │ _failed                                                       └───────────────┘
        └──────────────────────────────────────────────────────────────────────┘
```

| Service | Role | Binds to (routing key) | Publishes |
|---|---|---|---|
| `order-service` | HTTP API (FastAPI) that accepts new orders | — | `order.created` |
| `inventory-service` | Simulates a stock check | `order.created` | `order.inventory_reserved`, `order.inventory_failed` |
| `fraud-service` | Scores each order's fraud risk with a real (if lightweight) ML model | `order.created` | `order.fraud_checked` |
| `notification-service` | Simulates sending the customer a notification | `order.#` (everything under the `order.` namespace) | — |
| `dashboard-service` | Tracks every order's state in memory; exposes it over REST + WebSocket | `#` (literally everything on the exchange) | — |
| `frontend` | Next.js dashboard: order form, live event feed, stats charts, RabbitMQ topology view | — (talks to `order-service` and `dashboard-service` over HTTP/WS, not RabbitMQ directly) | — |

All order-lifecycle routing keys live under the `order.*` namespace, which is what lets
`notification-service` catch every one of them with a single `order.#` binding.
`dashboard-service` binds the widest possible pattern (`#`) since its whole job is observing the
exchange — it would pick up events from a differently-namespaced service too.

`inventory-service` and `fraud-service` are two **independent** consumers of the exact same
`order.created` event (topic-exchange fan-out — RabbitMQ delivers each of them their own copy,
with no coordination between the two). Fraud risk is scored in parallel with the stock check, not
after it, so an order that fails inventory still gets scored — chaining fraud-service off
inventory-service's output would silently skip exactly the failed/attempted orders a real fraud
signal cares about.

Why a **topic exchange**: it's the pattern most microservice architectures converge on. Publishers
don't know or care who consumes their events; consumers declare their own queue and bind whichever
routing keys they need (including wildcards). Adding `dashboard-service` — or `fraud-service` —
required zero changes to `order-service`, `inventory-service`, or `notification-service` — that's
the point.

### fraud-service's model

A real (if deliberately small) ML model, not a stub: at container startup, `fraud-service`
generates a synthetic labeled dataset (order total, item count, average unit price, and a
"customer order velocity" signal, combined through an actual logistic data-generating process) and
fits a scikit-learn `LogisticRegression` on it in-process — no external dataset, model file, or API
call. On every `order.created` it extracts the same features from the real order (tracking
per-customer order velocity with an in-memory rolling window) and publishes a `risk_score`
(0–1 probability) plus a boolean `flag` (`risk_score >= 0.6`) as `order.fraud_checked`.

## Running it

```bash
docker compose up --build
```

This starts:
- RabbitMQ with the management UI at http://localhost:15672 (user/pass: `guest`/`guest`)
- `order-service` HTTP API at http://localhost:8001 (Swagger UI at `/docs`)
- `dashboard-service` REST + WebSocket API at http://localhost:8002
- `inventory-service`, `fraud-service`, and `notification-service` as background consumers (watch their logs)
- **Frontend dashboard at http://localhost:3001**

## Trying it out

Open **http://localhost:3001** — you'll see a form to place orders, a live event feed, order
stats charts (by status, by fraud risk, over time), and a live view of the RabbitMQ exchange/queue
topology. Submit an order from the form and watch all panels update in real time. Submit several
orders under the same customer name in quick succession to watch the fraud-risk signal climb.

Or drive it from the API directly:

```bash
curl -X POST http://localhost:8001/orders \
  -H "Content-Type: application/json" \
  -d '{
        "customer": "ada",
        "items": [{"sku": "sku-1", "qty": 2, "price": 19.99}]
      }'
```

Watch `docker compose logs -f` — you'll see:
1. `order-service` publish `order.created`
2. `inventory-service` and `fraud-service` **both** receive it independently, and publish
   `order.inventory_reserved`/`order.inventory_failed` and `order.fraud_checked` respectively
3. `notification-service` receive every one of those events (it's bound to `order.#`) and log a
   human-readable notification
4. `dashboard-service` receive every event (`#`), update its in-memory order state, and push it to
   any connected frontend over WebSocket

You can also inspect exchanges, queues, and bindings live in the RabbitMQ management UI
(Exchanges → `ecommerce`), or via the dashboard's own topology panel, which polls the same
management API.

### Dashboard-service API

- `GET /api/orders` — every known order and its current status/history (including `risk_score`/`fraud_flag` once fraud-service has scored it)
- `GET /api/stats` — counts by status, reserved revenue, high-risk order count, average risk score
- `GET /api/topology` — live exchange/queue/binding info (proxies the RabbitMQ management API)
- `WS /ws` — pushes an event every time any order changes state

## Notes on reliability

- The exchange and queues are declared **durable**, and messages are published with
  `delivery_mode=PERSISTENT`, so they survive a RabbitMQ restart.
- Consumers use manual ack via `message.process()` — a message is only removed from the queue
  once the handler completes successfully; if a consumer crashes mid-handler, RabbitMQ redelivers it.
- Each service retries its initial RabbitMQ connection (`connect_with_retry`) so container start
  order doesn't matter beyond the `depends_on: condition: service_healthy` already in
  `docker-compose.yml`.
