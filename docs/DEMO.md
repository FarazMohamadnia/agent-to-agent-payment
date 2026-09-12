# Demo guide

## DEMO MODE — NO REAL FUNDS

Banner in UI and API responses: **DEMO MODE — NO REAL FUNDS**.

## Mode 1 — Autonomous Agent Demo (primary)

1. `npm run seed && npm run dev`
2. Open http://localhost:3000/
3. Click **Start Autonomous Agent Transaction**
4. Watch the live timeline, payment proof, and Dubai weather result

Expected:

- Seller selected: **Weather Data Agent A**
- Amount: **0.10 USDC**
- Buyer balance: **10.00 → 9.90**
- Service: Sunny / 31°C Dubai

## Mode 2 — Architecture Walkthrough

1. Open **Architecture Walkthrough** in the sidebar
2. Click **Run architecture walkthrough**
3. Observe the original 11 phases (register → listing → order → mock-pay → webhook → admin payout)

Use this mode to explain platform internals to judges/technical audiences.

## Seed accounts (legacy UI tabs)

| Email | Password | Role |
|---|---|---|
| provider@demo.local | Password123! | PROVIDER |
| buyer@demo.local | Password123! | BUYER |
| admin@demo.local | Password123! | ADMIN |

## Pitch (30 seconds)

> A Buyer Agent can discover another Agent, choose its service, agree on a price, follow its spending rules, make a simulated USDC payment, generate payment proof, and receive the service — with no human manually coordinating the transaction.
