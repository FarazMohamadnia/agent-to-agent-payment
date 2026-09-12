import { Agent } from '@prisma/client';
import { decimalStr } from '../utils/agentHelpers';

export interface SpendingPolicyResult {
  approved: boolean;
  reason?: string;
  checks: {
    currencyAllowed: boolean;
    underMaxTransaction: boolean;
    underDailyLimit: boolean;
  };
  policy: {
    maxTransaction: string | null;
    dailyLimit: string | null;
    dailySpent: string;
    allowedToken: string;
  };
}

export function evaluateSpendingPolicy(
  buyer: Agent,
  amount: string,
  currency: string,
): SpendingPolicyResult {
  const amt = Number(amount);
  const maxTx = buyer.maxTransaction != null ? Number(buyer.maxTransaction.toString()) : null;
  const dailyLimit = buyer.dailyLimit != null ? Number(buyer.dailyLimit.toString()) : null;
  const dailySpent = Number(buyer.dailySpent.toString());

  const currencyAllowed = currency === buyer.allowedToken;
  const underMaxTransaction = maxTx == null ? true : amt <= maxTx;
  const underDailyLimit = dailyLimit == null ? true : dailySpent + amt <= dailyLimit;

  const approved = currencyAllowed && underMaxTransaction && underDailyLimit;
  let reason: string | undefined;
  if (!currencyAllowed) reason = `Allowed token is ${buyer.allowedToken}, got ${currency}`;
  else if (!underMaxTransaction) reason = 'Transaction limit exceeded';
  else if (!underDailyLimit) reason = 'Daily spending limit exceeded';

  return {
    approved,
    reason,
    checks: { currencyAllowed, underMaxTransaction, underDailyLimit },
    policy: {
      maxTransaction: maxTx != null ? decimalStr(maxTx) : null,
      dailyLimit: dailyLimit != null ? decimalStr(dailyLimit) : null,
      dailySpent: decimalStr(dailySpent),
      allowedToken: buyer.allowedToken,
    },
  };
}
