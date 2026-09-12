import { Agent } from '@prisma/client';
import { prisma } from '../db/prisma';
import { AppError } from '../utils/errors';
import { decimalStr } from '../utils/agentHelpers';

export class MockWallet {
  async getBalance(agentId: string): Promise<{ balance: string; currency: string; walletAddress: string }> {
    const agent = await prisma.agent.findUnique({ where: { id: agentId } });
    if (!agent) throw new AppError(404, 'AGENT_NOT_FOUND', 'Agent not found');
    return {
      balance: decimalStr(agent.balance),
      currency: agent.currency,
      walletAddress: agent.walletAddress,
    };
  }

  canSpend(agent: Agent, amount: string, currency: string): { ok: boolean; reason?: string } {
    if (currency !== agent.currency) {
      return { ok: false, reason: `Wallet currency is ${agent.currency}, not ${currency}` };
    }
    const bal = Number(agent.balance.toString());
    const need = Number(amount);
    if (need > bal) {
      return { ok: false, reason: `Insufficient balance (${decimalStr(agent.balance)} ${agent.currency})` };
    }
    return { ok: true };
  }

  /**
   * Simulated USDC transfer — database balances only. No real funds / chain.
   */
  async mockTransfer(params: {
    fromAgentId: string;
    toAgentId: string;
    amount: string;
    currency: string;
  }): Promise<{ fromBalance: string; toBalance: string }> {
    const amount = Number(params.amount);
    if (!(amount > 0)) {
      throw new AppError(400, 'INVALID_AMOUNT', 'Transfer amount must be positive');
    }

    return prisma.$transaction(async (tx) => {
      const from = await tx.agent.findUnique({ where: { id: params.fromAgentId } });
      const to = await tx.agent.findUnique({ where: { id: params.toAgentId } });
      if (!from || !to) {
        throw new AppError(404, 'AGENT_NOT_FOUND', 'Agent not found');
      }
      const check = this.canSpend(from, params.amount, params.currency);
      if (!check.ok) {
        throw new AppError(400, 'INSUFFICIENT_BALANCE', check.reason || 'Cannot spend');
      }
      if (to.currency !== params.currency) {
        throw new AppError(400, 'CURRENCY_MISMATCH', 'Seller wallet currency mismatch');
      }

      const updatedFrom = await tx.agent.update({
        where: { id: from.id },
        data: { balance: Number(from.balance.toString()) - amount },
      });
      const updatedTo = await tx.agent.update({
        where: { id: to.id },
        data: { balance: Number(to.balance.toString()) + amount },
      });

      return {
        fromBalance: decimalStr(updatedFrom.balance),
        toBalance: decimalStr(updatedTo.balance),
      };
    });
  }
}

export const mockWallet = new MockWallet();
