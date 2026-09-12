import { Order } from '@prisma/client';
import { PaymentCheckResult, PaymentVerifier } from './PaymentVerifier';

/**
 * Demo verifier: payments are considered paid only after an explicit
 * mark via `POST /api/dev/mock-pay/:orderId` (non-production only).
 */
export class MockPaymentVerifier implements PaymentVerifier {
  private readonly paidOrders = new Set<string>();

  markPaid(orderId: string): void {
    this.paidOrders.add(orderId);
  }

  clear(orderId?: string): void {
    if (orderId) this.paidOrders.delete(orderId);
    else this.paidOrders.clear();
  }

  isMarked(orderId: string): boolean {
    return this.paidOrders.has(orderId);
  }

  async checkPayment(order: Order): Promise<PaymentCheckResult> {
    if (this.paidOrders.has(order.id)) {
      return { paid: true, confirmedAmount: order.amount.toString() };
    }
    return { paid: false };
  }
}

export const mockPaymentVerifier = new MockPaymentVerifier();
