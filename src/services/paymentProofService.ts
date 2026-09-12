import jwt from 'jsonwebtoken';
import { env } from '../config/env';

export interface AgentPaymentProofPayload {
  paymentId: string;
  quoteId?: string;
  fromAgentId: string;
  fromAgentName: string;
  toAgentId: string;
  toAgentName: string;
  amount: string;
  currency: string;
  transactionHash: string;
  status: 'VERIFIED';
  timestamp: string;
}

export function issueAgentPaymentProof(payload: AgentPaymentProofPayload): string {
  return jwt.sign(
    {
      type: 'agent_payment_proof',
      ...payload,
    },
    env.JWT_SECRET,
    { expiresIn: '7d' },
  );
}

export function verifyAgentPaymentProof(token: string): AgentPaymentProofPayload & {
  type: string;
} {
  const decoded = jwt.verify(token, env.JWT_SECRET) as AgentPaymentProofPayload & {
    type: string;
  };
  if (decoded.type !== 'agent_payment_proof') {
    throw new Error('Invalid proof type');
  }
  return decoded;
}
