import { prisma } from '../db/prisma';
import { AppError } from '../utils/errors';
import { mockTxHash, decimalStr } from '../utils/agentHelpers';
import { mockWallet } from '../payments/MockWallet';
import { evaluateSpendingPolicy } from './spendingPolicy';
import {
  assertQuoteActive,
  expireQuoteIfNeeded,
  markQuoteAccepted,
} from './quoteService';
import { issueAgentPaymentProof, verifyAgentPaymentProof } from './paymentProofService';

export class PaymentService {
  async createPaymentIntent(quoteId: string) {
    const existing = await prisma.agentPayment.findUnique({ where: { quoteId } });
    if (existing) {
      throw new AppError(409, 'PAYMENT_EXISTS', 'Payment already exists for this quote');
    }

    const quote = await expireQuoteIfNeeded(quoteId);
    if (!quote) throw new AppError(404, 'QUOTE_NOT_FOUND', 'Quote not found');
    assertQuoteActive(quote);

    const buyer = await prisma.agent.findUnique({ where: { id: quote.buyerAgentId } });
    const seller = await prisma.agent.findUnique({ where: { id: quote.sellerAgentId } });
    if (!buyer || !seller) throw new AppError(404, 'AGENT_NOT_FOUND', 'Agent not found');

    const amount = decimalStr(quote.price);
    const policy = evaluateSpendingPolicy(buyer, amount, quote.currency);
    if (!policy.approved) {
      throw new AppError(403, 'POLICY_REJECTED', policy.reason || 'Spending policy rejected', policy);
    }

    const walletCheck = mockWallet.canSpend(buyer, amount, quote.currency);
    if (!walletCheck.ok) {
      throw new AppError(400, 'INSUFFICIENT_BALANCE', walletCheck.reason || 'Insufficient balance');
    }

    return {
      quoteId: quote.id,
      fromAgentId: buyer.id,
      toAgentId: seller.id,
      amount,
      currency: quote.currency,
      policy,
      demoMode: true,
      notice: 'DEMO PAYMENT — NO REAL FUNDS',
    };
  }

  async executeMockPayment(quoteId: string) {
    const intent = await this.createPaymentIntent(quoteId);
    const quote = await prisma.quote.findUnique({ where: { id: quoteId } });
    if (!quote) throw new AppError(404, 'QUOTE_NOT_FOUND', 'Quote not found');

    const buyer = await prisma.agent.findUnique({ where: { id: quote.buyerAgentId } });
    const seller = await prisma.agent.findUnique({ where: { id: quote.sellerAgentId } });
    if (!buyer || !seller) throw new AppError(404, 'AGENT_NOT_FOUND', 'Agent not found');

    const amount = intent.amount;
    const balances = await mockWallet.mockTransfer({
      fromAgentId: buyer.id,
      toAgentId: seller.id,
      amount,
      currency: quote.currency,
    });

    await prisma.agent.update({
      where: { id: buyer.id },
      data: {
        dailySpent: Number(buyer.dailySpent.toString()) + Number(amount),
      },
    });

    const txHash = mockTxHash(`${quoteId}:${Date.now()}`);
    const paidAt = new Date();
    const timestamp = paidAt.toISOString();

    const payment = await prisma.agentPayment.create({
      data: {
        quoteId: quote.id,
        fromAgentId: buyer.id,
        toAgentId: seller.id,
        amount,
        currency: quote.currency,
        transactionHash: txHash,
        status: 'completed',
        paidAt,
      },
    });

    const proofToken = issueAgentPaymentProof({
      paymentId: payment.id,
      quoteId: quote.id,
      fromAgentId: buyer.id,
      fromAgentName: buyer.name,
      toAgentId: seller.id,
      toAgentName: seller.name,
      amount,
      currency: quote.currency,
      transactionHash: txHash,
      status: 'VERIFIED',
      timestamp,
    });

    const withProof = await prisma.agentPayment.update({
      where: { id: payment.id },
      data: { paymentProofToken: proofToken },
    });

    await markQuoteAccepted(quote.id);

    return {
      demoMode: true,
      notice: 'DEMO PAYMENT — NO REAL FUNDS',
      payment: serializePayment(withProof, buyer.name, seller.name),
      balances,
      policy: intent.policy,
      paymentProof: {
        status: 'VERIFIED',
        token: proofToken,
        paymentId: payment.id,
        transactionHash: txHash,
        amount,
        currency: quote.currency,
        fromAgent: buyer.name,
        toAgent: seller.name,
      },
    };
  }

  async verifyPaymentProof(token: string, expectedSellerAgentId: string) {
    let decoded;
    try {
      decoded = verifyAgentPaymentProof(token);
    } catch {
      throw new AppError(400, 'INVALID_PROOF', 'Payment proof is invalid or expired');
    }

    if (decoded.toAgentId !== expectedSellerAgentId) {
      throw new AppError(403, 'WRONG_RECEIVER', 'Payment proof receiver does not match seller');
    }

    const payment = await prisma.agentPayment.findUnique({
      where: { id: decoded.paymentId },
      include: {
        fromAgent: true,
        toAgent: true,
        quote: { include: { listing: true } },
      },
    });
    if (!payment) {
      throw new AppError(404, 'PAYMENT_NOT_FOUND', 'Payment does not exist');
    }
    if (payment.status !== 'completed') {
      throw new AppError(409, 'PAYMENT_NOT_COMPLETED', 'Payment is not completed');
    }
    if (decimalStr(payment.amount) !== decoded.amount) {
      throw new AppError(400, 'AMOUNT_MISMATCH', 'Proof amount does not match payment');
    }
    if (payment.currency !== decoded.currency) {
      throw new AppError(400, 'CURRENCY_MISMATCH', 'Proof currency does not match payment');
    }
    if (payment.toAgentId !== expectedSellerAgentId) {
      throw new AppError(403, 'WRONG_RECEIVER', 'Payment receiver mismatch');
    }
    if (payment.transactionHash !== decoded.transactionHash) {
      throw new AppError(400, 'TX_MISMATCH', 'Transaction hash mismatch');
    }

    return {
      verified: true,
      message: 'Payment Verified',
      payment: serializePayment(payment, payment.fromAgent.name, payment.toAgent.name),
      proof: decoded,
    };
  }
}

function serializePayment(
  payment: {
    id: string;
    quoteId: string | null;
    fromAgentId: string;
    toAgentId: string;
    amount: { toString(): string };
    currency: string;
    transactionHash: string;
    status: string;
    paymentProofToken: string | null;
    createdAt: Date;
    paidAt: Date | null;
  },
  fromName?: string,
  toName?: string,
) {
  return {
    paymentId: payment.id,
    quoteId: payment.quoteId,
    fromAgentId: payment.fromAgentId,
    toAgentId: payment.toAgentId,
    fromAgent: fromName,
    toAgent: toName,
    amount: decimalStr(payment.amount),
    currency: payment.currency,
    transactionHash: payment.transactionHash,
    status: payment.status === 'completed' ? 'VERIFIED' : payment.status,
    paymentProofToken: payment.paymentProofToken,
    createdAt: payment.createdAt.toISOString(),
    paidAt: payment.paidAt?.toISOString() ?? null,
  };
}

export const paymentService = new PaymentService();
