# Agent flow

## DEMO MODE — NO REAL FUNDS

All steps below use mock wallets and simulated USDC.

## Happy path

```text
Buyer Agent starts
→ Discover seller agents (capability filter)
→ Compare prices
→ Select cheapest valid provider
→ Request quote
→ (Optional) negotiate
→ Check spending policy
→ Create payment intent
→ Execute mock USDC payment (wallet debit/credit)
→ Generate payment proof (JWT)
→ Seller verifies payment proof
→ Seller delivers mock service
→ Buyer receives result
→ Transaction completed
```

## Default scenario

| Actor | Detail |
|---|---|
| Buyer | Research Agent — 10.00 USDC, max tx 1.00, daily 5.00 |
| Request | Weather data for Dubai, qty 100 |
| Sellers | A 0.10 · B 0.15 · C 0.20 USDC |
| Selection | Weather Data Agent A |
| Result | `{ city: "Dubai", temperature: 31, condition: "Sunny" }` |

## Payment proof (shape)

```json
{
  "paymentId": "…",
  "fromAgent": "Research Agent",
  "toAgent": "Weather Data Agent A",
  "amount": "0.10",
  "currency": "USDC",
  "transactionHash": "0xmock_…",
  "status": "VERIFIED"
}
```

Seller verification checks: payment exists, completed, amount, currency, receiver, matching tx hash, valid JWT proof.
