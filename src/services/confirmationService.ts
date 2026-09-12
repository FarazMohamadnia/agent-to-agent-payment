import jwt from 'jsonwebtoken';
import { env } from '../config/env';

export interface ConfirmationPayload {
  orderId: string;
  listingId: string;
  buyerDeliveryDomain: string;
  amount: string;
  currency: string;
  timestamp: string;
}

export function issueConfirmationToken(payload: ConfirmationPayload): string {
  return jwt.sign(
    {
      type: 'payment_confirmation',
      orderId: payload.orderId,
      listingId: payload.listingId,
      buyerDeliveryDomain: payload.buyerDeliveryDomain,
      amount: payload.amount,
      currency: payload.currency,
      timestamp: payload.timestamp,
    },
    env.JWT_SECRET,
    { expiresIn: '7d' },
  );
}
