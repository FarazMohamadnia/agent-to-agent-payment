# Agent-to-Agent Payment Validation Platform

Demo/MVP marketplace + escrow-style **payment-proof broker** for agent-to-agent commerce.

Providers list services and payout references. Buyers create orders, pay to a platform-generated payment reference, and supply a delivery domain. Once payment is verified, the platform issues a signed confirmation to the Provider (webhook + polling). The Provider delivers the purchased data/access **directly** to the Buyer — the platform never sees or stores the paid content.

## Compliance disclaimer

> **This is a demo/MVP.** It does not custody real user funds, does not perform KYC/AML, and does not automate payouts. Before handling real money movement between users, this project would require: (a) legal review of money-transmission/payment-facilitator regulations in the relevant jurisdictions, (b) KYC/AML procedures, (c) a licensed payment processor or custodial partner instead of the mock verifier, and (d) a security audit. The `PaymentVerifier` interface is intentionally pluggable so a compliant, audited payment backend can be substituted later without changing the rest of the system.

## Quick start

```bash
git clone <repo-url> agent-payment
cd agent-payment
cp .env.example .env
npm install
npx prisma db push
npm run seed
npm run dev
```

API listens on `http://localhost:3000` by default.

### Demo UI

Open **http://localhost:3000/** for the English ops console:

- Auth (login/register + one-click demo accounts)
- **Phased demo** — one-click architecture walkthrough (two agents, pay, validate, webhook, payout)
- Public catalog
- Provider listings CRUD
- Buyer order → mock pay → verify → status
- Admin orders + payout mark
- Live **server activity**, **client error log**, and **webhook delivery logs**

Static assets are served from `/ui/*`.

### Scripts

| Script | Purpose |
|---|---|
| `npm run dev` | Start API with hot reload (`tsx watch`) |
| `npm run build` | Compile TypeScript to `dist/` |
| `npm start` | Run compiled `dist/server.js` |
| `npm test` | Run Jest suite |
| `npm run test:coverage` | Run tests with coverage |
| `npm run seed` | Load demo users, listings, and a sample order |

## Environment variables

See `.env.example`. Key variables:

- `DATABASE_URL` — SQLite file URL for MVP (`file:./dev.db`); swap provider to PostgreSQL later
- `JWT_SECRET` — HMAC secret for access + confirmation tokens
- `CORS_ORIGINS` — comma-separated allowlist, or `*`
- `ORDER_EXPIRY_MINUTES` — payment window
- `WEBHOOK_TIMEOUT_MS` / `WEBHOOK_MAX_ATTEMPTS` — outgoing webhook delivery settings

## Demo accounts (after seed)

| Email | Password | Role |
|---|---|---|
| `provider@demo.local` | `Password123!` | PROVIDER |
| `provider2@demo.local` | `Password123!` | PROVIDER |
| `buyer@demo.local` | `Password123!` | BUYER |
| `admin@demo.local` | `Password123!` | ADMIN |

## End-to-end demo (curl)

```bash
# 1) Register provider
PROVIDER=$(curl -s -X POST http://localhost:3000/api/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"email":"prov@example.com","password":"Password123!","role":"PROVIDER"}')
PROVIDER_TOKEN=$(echo "$PROVIDER" | jq -r .token)

# 2) Create listing
LISTING=$(curl -s -X POST http://localhost:3000/api/listings \
  -H "Authorization: Bearer $PROVIDER_TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{
    "serviceName":"Weather Agent",
    "description":"City forecasts",
    "providerServerDomain":"https://weather.example",
    "price":"5.00",
    "currency":"USDT",
    "payoutAddress":"TDemoPayout",
    "providerWebhookUrl":"https://webhook.site/your-id"
  }')
LISTING_ID=$(echo "$LISTING" | jq -r .listing.id)
echo "$LISTING" | jq -r .listing.providerWebhookSecret   # store this for HMAC verify

# 3) Public catalog (no auth)
curl -s http://localhost:3000/api/public/listings | jq

# 4) Register buyer + create order
BUYER=$(curl -s -X POST http://localhost:3000/api/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"email":"buy@example.com","password":"Password123!","role":"BUYER"}')
BUYER_TOKEN=$(echo "$BUYER" | jq -r .token)

ORDER=$(curl -s -X POST http://localhost:3000/api/orders \
  -H "Authorization: Bearer $BUYER_TOKEN" \
  -H 'Content-Type: application/json' \
  -d "{\"listingId\":\"$LISTING_ID\",\"buyerDeliveryDomain\":\"https://buyer.example/inbox\"}")
ORDER_ID=$(echo "$ORDER" | jq -r .order.id)
echo "$ORDER" | jq .order.paymentReference,.order.amount,.order.expiresAt

# 5) Simulate payment (dev/mock only — disabled in production)
curl -s -X POST "http://localhost:3000/api/dev/mock-pay/$ORDER_ID" | jq

# 6) Verify payment → issues confirmation + notifies provider webhook
curl -s -X POST "http://localhost:3000/api/orders/$ORDER_ID/verify-payment" \
  -H "Authorization: Bearer $BUYER_TOKEN" | jq

# 7) Poll status (buyer or provider)
curl -s "http://localhost:3000/api/orders/$ORDER_ID/status" \
  -H "Authorization: Bearer $BUYER_TOKEN" | jq

# 8) Admin marks manual payout sent
ADMIN=$(curl -s -X POST http://localhost:3000/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@demo.local","password":"Password123!"}')
ADMIN_TOKEN=$(echo "$ADMIN" | jq -r .token)

curl -s -X PATCH "http://localhost:3000/api/admin/orders/$ORDER_ID/payout" \
  -H "Authorization: Bearer $ADMIN_TOKEN" | jq
```

## Provider delivery contract (outside platform)

After receiving a verified `order.paid` webhook (see `docs/webhook-contract.md`) and confirming via `GET /api/orders/:id/status`, the Provider should deliver the purchased data/access **directly** to `buyerDeliveryDomain`. The platform does not perform or store that delivery.

## Docs

- [ARCHITECTURE.md](./ARCHITECTURE.md) — modules, flow diagram, assumptions
- [docs/openapi.yaml](./docs/openapi.yaml) — OpenAPI 3.0
- [docs/webhook-contract.md](./docs/webhook-contract.md) — outgoing webhook + HMAC sample
- [BUILD_STATUS.md](./BUILD_STATUS.md) — what was built and tested

## License

MIT
