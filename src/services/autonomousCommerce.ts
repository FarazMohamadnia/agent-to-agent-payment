import { prisma } from '../db/prisma';
import { AppError } from '../utils/errors';
import { discoverOffers } from './agentService';
import { agentDecisionEngine } from './decisionEngine';
import { createQuote, negotiateQuote } from './quoteService';
import { paymentService } from './paymentService';
import { deliverService } from './deliveryService';
import { evaluateSpendingPolicy } from './spendingPolicy';
import { decimalStr } from '../utils/agentHelpers';

export interface TimelineStep {
  id: string;
  label: string;
  status: 'pending' | 'running' | 'done' | 'failed';
  at?: string;
  data?: unknown;
}

function step(id: string, label: string): TimelineStep {
  return { id, label, status: 'pending' };
}

/**
 * One-click autonomous Agent-to-Agent commerce demo (all mock / no real funds).
 */
export async function runAutonomousTransaction(params?: {
  capability?: string;
  city?: string;
  quantity?: number;
  negotiateTo?: string;
}) {
  const capability = params?.capability || 'weather-data';
  const city = params?.city || 'Dubai';
  const quantity = params?.quantity || 100;

  const timeline: TimelineStep[] = [
    step('start', 'Buyer Agent started'),
    step('discover', 'Searching for services…'),
    step('compare', 'Comparing prices…'),
    step('select', 'Provider selected'),
    step('quote', 'Quote received'),
    step('policy', 'Spending policy checked'),
    step('pay', 'Mock USDC payment executed'),
    step('proof', 'Payment proof generated'),
    step('verify', 'Seller Agent verified payment'),
    step('deliver', 'Service delivered'),
    step('complete', 'Transaction completed'),
  ];

  const mark = (id: string, status: TimelineStep['status'], data?: unknown) => {
    const s = timeline.find((t) => t.id === id);
    if (!s) return;
    s.status = status;
    s.at = new Date().toISOString();
    if (data !== undefined) s.data = data;
  };

  try {
    const buyer = await prisma.agent.findFirst({
      where: { type: 'BUYER', name: 'Research Agent', status: 'active' },
    });
    if (!buyer) {
      throw new AppError(
        500,
        'DEMO_NOT_SEEDED',
        'Research Agent not found — run npm run seed',
      );
    }
    mark('start', 'done', {
      agent: buyer.name,
      balance: decimalStr(buyer.balance),
      currency: buyer.currency,
      request: { capability, city, quantity },
      demoMode: true,
      notice: 'DEMO MODE — NO REAL FUNDS',
    });

    mark('discover', 'running');
    const offers = await discoverOffers(capability);
    mark('discover', 'done', {
      discovered: offers.length,
      agents: offers.map((o) => o.agentName),
    });

    mark('compare', 'running');
    const ranked = agentDecisionEngine.comparePrices(offers);
    mark('compare', 'done', {
      ranked: ranked.map((o) => ({
        agent: o.agentName,
        price: o.price,
        currency: o.currency,
      })),
    });

    mark('select', 'running');
    const selected = agentDecisionEngine.selectCheapest(offers, capability, 'USDC');
    mark('select', 'done', agentDecisionEngine.summarizeSelection(selected, ranked));

    mark('quote', 'running');
    let quote = await createQuote({
      buyerAgentId: buyer.id,
      sellerAgentId: selected.agentId,
      listingId: selected.listingId,
      quantity,
    });

    if (params?.negotiateTo) {
      const neg = await negotiateQuote(quote.id, params.negotiateTo);
      if (neg.accepted) quote = neg.quote;
    }

    mark('quote', 'done', {
      quoteId: quote.id,
      price: quote.price,
      currency: quote.currency,
      quantity: quote.quantity,
      expiresIn: quote.expiresIn,
    });

    mark('policy', 'running');
    const freshBuyer = await prisma.agent.findUnique({ where: { id: buyer.id } });
    const policy = evaluateSpendingPolicy(freshBuyer!, quote.price, quote.currency);
    if (!policy.approved) {
      mark('policy', 'failed', policy);
      throw new AppError(403, 'POLICY_REJECTED', policy.reason || 'Rejected', policy);
    }
    mark('policy', 'done', { status: 'APPROVED', ...policy });

    mark('pay', 'running');
    const paid = await paymentService.executeMockPayment(quote.id);
    mark('pay', 'done', {
      notice: paid.notice,
      amount: paid.payment.amount,
      currency: paid.payment.currency,
      transactionHash: paid.payment.transactionHash,
      balances: paid.balances,
    });

    mark('proof', 'done', paid.paymentProof);

    mark('verify', 'running');
    const verified = await paymentService.verifyPaymentProof(
      paid.paymentProof.token,
      selected.agentId,
    );
    mark('verify', 'done', {
      message: 'Payment Verified ✓',
      verified: verified.verified,
    });

    mark('deliver', 'running');
    const delivery = await deliverService({
      paymentId: paid.payment.paymentId,
      sellerAgentId: selected.agentId,
      paymentProofToken: paid.paymentProof.token,
      request: { city },
    });
    mark('deliver', 'done', delivery.delivery);

    mark('complete', 'done', {
      message: 'AUTONOMOUS TRANSACTION COMPLETE ✓',
      demoMode: true,
      notice: 'DEMO MODE — NO REAL FUNDS',
    });

    const buyerAfter = await prisma.agent.findUnique({ where: { id: buyer.id } });
    const sellerAfter = await prisma.agent.findUnique({ where: { id: selected.agentId } });

    return {
      ok: true,
      demoMode: true,
      notice: 'DEMO MODE — NO REAL FUNDS',
      timeline,
      result: {
        buyer: {
          name: buyer.name,
          balanceBefore: decimalStr(buyer.balance),
          balanceAfter: decimalStr(buyerAfter!.balance),
        },
        seller: {
          name: selected.agentName,
          balanceAfter: decimalStr(sellerAfter!.balance),
        },
        payment: paid.payment,
        paymentProof: paid.paymentProof,
        serviceResult: delivery.delivery.result,
      },
    };
  } catch (err) {
    const running = timeline.find((t) => t.status === 'running');
    if (running) {
      running.status = 'failed';
      running.at = new Date().toISOString();
      running.data = {
        message: err instanceof Error ? err.message : 'Unknown error',
      };
    }
    throw err;
  }
}
