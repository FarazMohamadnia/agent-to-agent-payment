import { AgentType } from '@prisma/client';
import { prisma } from '../../src/db/prisma';
import { resetDatabase } from '../helpers';
import { stringifyCapabilities } from '../../src/utils/agentHelpers';
import { agentDecisionEngine } from '../../src/services/decisionEngine';
import { evaluateSpendingPolicy } from '../../src/services/spendingPolicy';
import { mockWallet } from '../../src/payments/MockWallet';
import { createQuote, negotiateQuote, expireQuoteIfNeeded } from '../../src/services/quoteService';
import { paymentService } from '../../src/services/paymentService';
import { deliverService } from '../../src/services/deliveryService';
import { discoverOffers, listAgents } from '../../src/services/agentService';
import { AppError } from '../../src/utils/errors';
import { issueAgentPaymentProof } from '../../src/services/paymentProofService';

async function seedAgents() {
  const buyer = await prisma.agent.create({
    data: {
      name: 'Research Agent',
      type: AgentType.BUYER,
      description: 'Buyer',
      walletAddress: `0xBuyer_${Date.now()}`,
      balance: '10.00',
      currency: 'USDC',
      capabilities: stringifyCapabilities(['discovery']),
      maxTransaction: '1.00',
      dailyLimit: '5.00',
      dailySpent: '0',
      allowedToken: 'USDC',
    },
  });

  const sellerA = await prisma.agent.create({
    data: {
      name: 'Weather Data Agent A',
      type: AgentType.SELLER,
      description: 'Cheap',
      walletAddress: `0xWA_${Date.now()}`,
      balance: '0',
      currency: 'USDC',
      capabilities: stringifyCapabilities(['weather-data']),
    },
  });
  const sellerB = await prisma.agent.create({
    data: {
      name: 'Weather Data Agent B',
      type: AgentType.SELLER,
      description: 'Mid',
      walletAddress: `0xWB_${Date.now()}`,
      balance: '0',
      currency: 'USDC',
      capabilities: stringifyCapabilities(['weather-data']),
    },
  });

  const providerUser = await prisma.user.create({
    data: {
      email: `prov_${Date.now()}@t.local`,
      passwordHash: 'x',
      role: 'PROVIDER',
    },
  });

  const listingA = await prisma.listing.create({
    data: {
      providerId: providerUser.id,
      agentId: sellerA.id,
      capability: 'weather-data',
      unitLabel: '100 requests',
      serviceName: 'Weather Data',
      description: 'A',
      providerServerDomain: 'https://a.example',
      price: '0.10',
      currency: 'USDC',
      payoutAddress: sellerA.walletAddress,
      providerWebhookUrl: 'https://a.example/hook',
      providerWebhookSecret: 'secret',
    },
  });
  await prisma.listing.create({
    data: {
      providerId: providerUser.id,
      agentId: sellerB.id,
      capability: 'weather-data',
      serviceName: 'Weather Data',
      description: 'B',
      providerServerDomain: 'https://b.example',
      price: '0.15',
      currency: 'USDC',
      payoutAddress: sellerB.walletAddress,
      providerWebhookUrl: 'https://b.example/hook',
      providerWebhookSecret: 'secret',
    },
  });

  return { buyer, sellerA, sellerB, listingA };
}

describe('V2 Agent commerce units', () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it('discovers agents and filters by capability', async () => {
    await seedAgents();
    const all = await listAgents();
    expect(all.length).toBeGreaterThanOrEqual(3);
    const weather = await listAgents('weather-data');
    expect(weather.every((a) => a.capabilities.includes('weather-data'))).toBe(true);
    const offers = await discoverOffers('weather-data');
    expect(offers.length).toBe(2);
  });

  it('decision engine selects cheapest and rejects empty', () => {
    const offers = [
      {
        agentId: '1',
        agentName: 'B',
        capability: 'weather-data',
        serviceName: 'W',
        listingId: 'l2',
        price: '0.15',
        currency: 'USDC',
        unitLabel: null,
        description: '',
      },
      {
        agentId: '2',
        agentName: 'A',
        capability: 'weather-data',
        serviceName: 'W',
        listingId: 'l1',
        price: '0.10',
        currency: 'USDC',
        unitLabel: null,
        description: '',
      },
    ];
    const selected = agentDecisionEngine.selectCheapest(offers, 'weather-data');
    expect(selected.agentName).toBe('A');
    expect(() => agentDecisionEngine.selectCheapest([], 'weather-data')).toThrow(AppError);
  });

  it('spending policy approves and rejects limits', async () => {
    const { buyer } = await seedAgents();
    const ok = evaluateSpendingPolicy(buyer, '0.10', 'USDC');
    expect(ok.approved).toBe(true);
    const overTx = evaluateSpendingPolicy(buyer, '2.00', 'USDC');
    expect(overTx.approved).toBe(false);
    expect(overTx.reason).toMatch(/Transaction limit/i);

    await prisma.agent.update({
      where: { id: buyer.id },
      data: { dailySpent: '4.95' },
    });
    const refreshed = await prisma.agent.findUnique({ where: { id: buyer.id } });
    const overDaily = evaluateSpendingPolicy(refreshed!, '0.20', 'USDC');
    expect(overDaily.approved).toBe(false);
  });

  it('mock wallet transfer and insufficient balance', async () => {
    const { buyer, sellerA } = await seedAgents();
    const ok = await mockWallet.mockTransfer({
      fromAgentId: buyer.id,
      toAgentId: sellerA.id,
      amount: '0.10',
      currency: 'USDC',
    });
    expect(ok.fromBalance).toBe('9.90');
    expect(ok.toBalance).toBe('0.10');

    await expect(
      mockWallet.mockTransfer({
        fromAgentId: buyer.id,
        toAgentId: sellerA.id,
        amount: '100',
        currency: 'USDC',
      }),
    ).rejects.toMatchObject({ code: 'INSUFFICIENT_BALANCE' });
  });

  it('quote create, negotiate, expire', async () => {
    const { buyer, sellerA, listingA } = await seedAgents();
    const quote = await createQuote({
      buyerAgentId: buyer.id,
      sellerAgentId: sellerA.id,
      listingId: listingA.id,
      quantity: 100,
    });
    expect(quote.price).toBe('0.10');

    const neg = await negotiateQuote(quote.id, '0.08');
    expect(neg.accepted).toBe(true);
    expect(neg.quote.price).toBe('0.08');

    await prisma.quote.update({
      where: { id: quote.id },
      data: { expiresAt: new Date(Date.now() - 1000), status: 'offered' },
    });
    const expired = await expireQuoteIfNeeded(quote.id);
    expect(expired?.status).toBe('expired');
  });

  it('payment, proof, delivery, duplicates', async () => {
    const { buyer, sellerA, listingA } = await seedAgents();
    const quote = await createQuote({
      buyerAgentId: buyer.id,
      sellerAgentId: sellerA.id,
      listingId: listingA.id,
      quantity: 100,
    });

    const paid = await paymentService.executeMockPayment(quote.id);
    expect(paid.payment.transactionHash).toMatch(/^0xmock_/);
    expect(paid.paymentProof.status).toBe('VERIFIED');

    await expect(paymentService.executeMockPayment(quote.id)).rejects.toMatchObject({
      code: 'PAYMENT_EXISTS',
    });

    const verified = await paymentService.verifyPaymentProof(
      paid.paymentProof.token,
      sellerA.id,
    );
    expect(verified.verified).toBe(true);

    const bad = issueAgentPaymentProof({
      paymentId: paid.payment.paymentId,
      fromAgentId: buyer.id,
      fromAgentName: buyer.name,
      toAgentId: '00000000-0000-0000-0000-000000000099',
      toAgentName: 'Wrong',
      amount: '0.10',
      currency: 'USDC',
      transactionHash: paid.payment.transactionHash,
      status: 'VERIFIED',
      timestamp: new Date().toISOString(),
    });
    await expect(
      paymentService.verifyPaymentProof(bad, sellerA.id),
    ).rejects.toMatchObject({ code: 'WRONG_RECEIVER' });

    const delivery = await deliverService({
      paymentId: paid.payment.paymentId,
      sellerAgentId: sellerA.id,
      paymentProofToken: paid.paymentProof.token,
      request: { city: 'Dubai' },
    });
    expect(delivery.delivery.result).toMatchObject({
      city: 'Dubai',
      temperature: 31,
    });

    await expect(
      deliverService({
        paymentId: paid.payment.paymentId,
        sellerAgentId: sellerA.id,
        paymentProofToken: paid.paymentProof.token,
        request: { city: 'Dubai' },
      }),
    ).rejects.toMatchObject({ code: 'ALREADY_DELIVERED' });
  });
});
