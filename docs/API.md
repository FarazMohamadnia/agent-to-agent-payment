# API (v2 additions)

Base URL: `http://localhost:3000`

All v2 commerce endpoints below are **demo/mock** and do not move real funds.

## Agents & offers

| Method | Path | Description |
|---|---|---|
| GET | `/api/agents` | List active agents (optional `?capability=`) |
| GET | `/api/agents/:id` | Agent public profile + spending policy (buyers) |
| GET | `/api/offers` | Discoverable services (optional `?capability=`) |

## Quotes

| Method | Path | Description |
|---|---|---|
| POST | `/api/quotes` | Create quote `{ buyerAgentId, sellerAgentId, listingId, quantity }` |
| GET | `/api/quotes/:id` | Get quote |
| POST | `/api/quotes/:id/negotiate` | `{ counterPrice }` — deterministic accept ≥ 80% |

## Payments & delivery

| Method | Path | Description |
|---|---|---|
| POST | `/api/payments/intent` | `{ quoteId }` — policy + balance precheck |
| POST | `/api/payments/execute` | `{ quoteId }` — mock transfer + proof |
| POST | `/api/payments/verify` | `{ paymentProofToken, sellerAgentId }` |
| POST | `/api/deliveries` | Deliver mock service after proof |

## Autonomous demo

| Method | Path | Description |
|---|---|---|
| POST | `/api/demo/autonomous` | One-click full timeline run |

Example:

```bash
curl -s -X POST http://localhost:3000/api/demo/autonomous \
  -H 'Content-Type: application/json' \
  -d '{"capability":"weather-data","city":"Dubai","quantity":100}' | jq
```

## Legacy MVP (Architecture Walkthrough)

Auth, listings, public catalog, orders, mock-pay, admin payout, webhook sink — see `docs/openapi.yaml` and `docs/webhook-contract.md`.
