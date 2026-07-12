# Service Communication using RabbitMQ

A realistic demo of event-driven microservice communication using RabbitMQ (Python backend,
Next.js dashboard).

## Highlight: real ML fraud scoring, wired into the event bus like any other service

The standout piece of this project is `fraud-service` — a genuine, trained machine-learning
model, not a rule-based stub and not a call to an external API:

- **It's a real model.** A scikit-learn `LogisticRegression`, fit at container startup on a
  synthetic dataset built from an actual logistic data-generating process (not hand-picked
  `if total > 500` thresholds). Every order gets a real `risk_score` between 0 and 1.
- **It uses genuine fraud signals.** Order total, item count, average unit price, and a live
  per-customer *order-velocity* window — the same category of signal real fraud systems lean on.
- **It's a first-class citizen of the architecture, not bolted on.** It binds `order.created`
  exactly the way `inventory-service` does, scores in parallel via RabbitMQ's topic-exchange
  fan-out, and publishes its verdict back onto the same exchange. Adding it required **zero
  changes** to `order-service` — the whole point of the event-driven design below.
- **It's verifiable, not just decorative.** Place a $10 order and a $900 order and watch the
  score respond; place several orders from the same customer in a row and watch the risk climb
  live as the velocity signal kicks in. See [Trying it out](#trying-it-out) and
  [fraud-service's model](#fraud-services-model) for exactly how.

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

At container startup — before a single order arrives — `fraud-service`:

1. **Generates 3,000 synthetic training orders** (`fraud-service/app/model.py`): total, item
   count, quantity, average unit price, and a "customer order velocity" feature, each drawn from
   distributions chosen to resemble a real order stream (e.g. `lognormal` for order total, so
   most orders are modest and a few are large — like real purchases).
2. **Labels them through an actual logistic data-generating process**, not an ad-hoc rule:
   `z = w1·total + w2·avg_unit_price + w3·velocity + noise`, `p = sigmoid(z)`,
   `label = Bernoulli(p)`. This matters because it means `LogisticRegression` is the *correct*
   model family for this data, not just one fit on top of it after the fact.
3. **Fits a scikit-learn `Pipeline(StandardScaler → LogisticRegression)`** on that data, seeded
   for reproducible results across restarts — all in-process, in well under a second, with no
   external dataset, model file, or API call.

From then on, every `order.created` event runs through the same pipeline:

- Features are extracted from the real order (`total`, `item_count`, `total_qty`,
  `avg_unit_price`), plus a live **velocity** count — how many orders that same customer has
  placed in the last 120 seconds, tracked in a rolling in-memory window.
- The model returns `risk_score = pipeline.predict_proba(X)[0][1]` — a genuine probability, not a
  hardcoded number — and `flag = risk_score >= 0.6`.
- The result is published back onto the exchange as `order.fraud_checked`, exactly like every
  other event in this system.

**Proof it's real, not decorative** (see it yourself with `docker compose logs -f fraud-service`):
a cheap, one-off order scores low (`risk=0.07`), a $950 outlier order saturates high (`risk=1.0`),
and five rapid orders from the same customer climb visibly (`0.36 → 0.75 → 0.94 → 0.99 → 1.0`) as
the velocity signal accumulates — three independent, verifiable signs this is a working model
responding to real input, not a stub returning a constant or a coin flip.

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
