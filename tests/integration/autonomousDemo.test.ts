import request from 'supertest';
import { createApp } from '../../src/app';
import { resetDatabase } from '../helpers';
import { PrismaClient, AgentType, Role } from '@prisma/client';
import { stringifyCapabilities } from '../../src/utils/agentHelpers';

const prisma = new PrismaClient();
const app = createApp();

async function seedDemoWorld() {
  const provider = await prisma.user.create({
    data: {
      email: `p_${Date.now()}@t.local`,
      passwordHash: 'x',
      role: Role.PROVIDER,
    },
  });

  const research = await prisma.agent.create({
    data: {
      name: 'Research Agent',
      type: AgentType.BUYER,
      description: 'Buyer',
      walletAddress: `0xDemoBuyer_${Date.now()}`,
      balance: '10.00',
      currency: 'USDC',
      capabilities: stringifyCapabilities(['discovery']),
      maxTransaction: '1.00',
      dailyLimit: '5.00',
      allowedToken: 'USDC',
    },
  });

  const makers = [
    { name: 'Weather Data Agent A', price: '0.10', wallet: 'A' },
    { name: 'Weather Data Agent B', price: '0.15', wallet: 'B' },
    { name: 'Weather Data Agent C', price: '0.20', wallet: 'C' },
  ];

  for (const m of makers) {
    const seller = await prisma.agent.create({
      data: {
        name: m.name,
        type: AgentType.SELLER,
        description: m.name,
        walletAddress: `0x${m.wallet}_${Date.now()}_${Math.random()}`,
        balance: '0',
        currency: 'USDC',
        capabilities: stringifyCapabilities(['weather-data']),
      },
    });
    await prisma.listing.create({
      data: {
        providerId: provider.id,
        agentId: seller.id,
        capability: 'weather-data',
        unitLabel: '100 requests',
        serviceName: 'Weather Data',
        description: 'Simulated',
        providerServerDomain: 'https://w.example',
        price: m.price,
        currency: 'USDC',
        payoutAddress: seller.walletAddress,
        providerWebhookUrl: 'https://w.example/hook',
        providerWebhookSecret: 'secret',
      },
    });
  }

  return research;
}

describe('V2 autonomous end-to-end', () => {
  beforeEach(async () => {
    await resetDatabase();
    await seedDemoWorld();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('runs Buyer → discover → select cheapest → quote → policy → pay → proof → verify → deliver', async () => {
    const res = await request(app)
      .post('/api/demo/autonomous')
      .send({ capability: 'weather-data', city: 'Dubai', quantity: 100 })
      .expect(200);

    expect(res.body.ok).toBe(true);
    expect(res.body.demoMode).toBe(true);
    expect(res.body.notice).toMatch(/NO REAL FUNDS/i);
    expect(res.body.result.seller.name).toBe('Weather Data Agent A');
    expect(res.body.result.payment.amount).toBe('0.10');
    expect(res.body.result.payment.currency).toBe('USDC');
    expect(res.body.result.payment.transactionHash).toMatch(/^0xmock_/);
    expect(res.body.result.paymentProof.status).toBe('VERIFIED');
    expect(res.body.result.serviceResult).toMatchObject({
      city: 'Dubai',
      temperature: 31,
      condition: 'Sunny',
    });
    expect(res.body.result.buyer.balanceAfter).toBe('9.90');

    const done = (res.body.timeline || []).filter((t: { status: string }) => t.status === 'done');
    expect(done.length).toBeGreaterThanOrEqual(10);
  });

  it('lists agents and offers publicly', async () => {
    const agents = await request(app).get('/api/agents?capability=weather-data').expect(200);
    expect(agents.body.agents.length).toBe(3);
    const offers = await request(app).get('/api/offers?capability=weather-data').expect(200);
    expect(offers.body.offers[0].price).toBe('0.10');
  });
});
