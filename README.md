# Agent-to-Agent Commerce & Payment Demo (v2)

> This project demonstrates **autonomous Agent-to-Agent commerce** where software agents can discover services, compare prices, follow spending policies, execute **simulated USDC** payments, generate verifiable payment proofs, and receive services from another agent.

## DEMO MODE — NO REAL FUNDS

```text
This is a hackathon demo.

All agents are simulated software agents.
All wallets and balances are mock data.
All payments are simulated.
No real funds are transferred.
No real blockchain transactions are executed.
No production financial infrastructure is provided.
No external paid AI/API key is required.
```

## Quick start

```bash
cp .env.example .env
npm install --ignore-scripts && npx prisma generate && npx prisma db push
npm run seed
npm run dev
```

Open **http://localhost:3000/**

### Two demo modes

| Mode | UI nav | Purpose |
|---|---|---|
| **Autonomous Agent Demo** | Default home | One-click Research Agent → Weather Agent commerce |
| **Architecture Walkthrough** | Second nav item | Original 11-phase payment-validation technical demo |

### Scripts

| Script | Purpose |
|---|---|
| `npm run dev` | Build + watch server |
| `npm run build` | Compile TypeScript |
| `npm start` | Run `dist/server.js` |
| `npm test` | Jest suite |
| `npm run test:coverage` | Coverage report |
| `npm run seed` | Demo users + V2 agents + listings |

## Default autonomous scenario

1. **Research Agent** (Buyer) starts with **10.00 USDC**
2. Discovers Weather Data Agents A/B/C at **0.10 / 0.15 / 0.20 USDC**
3. Selects **Agent A** (cheapest)
4. Quote **0.10 USDC** — spending policy **APPROVED** (max 1.00 / daily 5.00)
5. Mock USDC payment → proof `0xmock_…`
6. Seller verifies proof → delivers `{ city: "Dubai", temperature: 31, condition: "Sunny" }`

## Compliance disclaimer

> **This is a demo/MVP.** It does not custody real user funds, does not perform KYC/AML, and does not automate real payouts. Before handling real money movement between users, this project would require: (a) legal review of money-transmission/payment-facilitator regulations in the relevant jurisdictions, (b) KYC/AML procedures, (c) a licensed payment processor or custodial partner instead of the mock verifier, and (d) a security audit. The `PaymentVerifier` interface and mock wallet are intentionally pluggable so a compliant, audited payment backend can be substituted later without changing the rest of the system.

## Docs

- [ARCHITECTURE.md](./ARCHITECTURE.md)
- [docs/AGENT_FLOW.md](./docs/AGENT_FLOW.md)
- [docs/API.md](./docs/API.md)
- [docs/DEMO.md](./docs/DEMO.md)
- [docs/openapi.yaml](./docs/openapi.yaml)
- [docs/webhook-contract.md](./docs/webhook-contract.md)
- [BUILD_STATUS.md](./BUILD_STATUS.md)

## License

MIT
