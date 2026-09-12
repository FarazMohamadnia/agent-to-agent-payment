import { Order } from '@prisma/client';

export interface PaymentCheckResult {
  paid: boolean;
  confirmedAmount?: string;
}

export interface PaymentVerifier {
  checkPayment(order: Order): Promise<PaymentCheckResult>;
}
