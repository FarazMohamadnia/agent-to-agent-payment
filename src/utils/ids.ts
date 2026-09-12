import { randomBytes } from 'crypto';
import { v4 as uuidv4 } from 'uuid';

export function generatePaymentReference(): string {
  return `pay_${uuidv4().replace(/-/g, '')}`;
}

export function generateWebhookSecret(): string {
  return randomBytes(32).toString('hex');
}
