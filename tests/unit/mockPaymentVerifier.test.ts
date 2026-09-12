import { MockPaymentVerifier } from '../../src/payments/MockPaymentVerifier';
import { Order, OrderStatus } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';

function fakeOrder(id: string): Order {
  return {
    id,
    listingId: 'listing-1',
    buyerId: 'buyer-1',
    buyerDeliveryDomain: 'https://buyer.example/inbox',
    amount: new Decimal('10.00'),
    currency: 'USDT',
    paymentReference: 'pay_abc',
    status: OrderStatus.pending_payment,
    confirmationToken: null,
    createdAt: new Date(),
    paidAt: null,
    expiresAt: new Date(Date.now() + 60_000),
  };
}

describe('MockPaymentVerifier', () => {
  it('reports unpaid until marked', async () => {
    const verifier = new MockPaymentVerifier();
    const order = fakeOrder('ord-1');
    await expect(verifier.checkPayment(order)).resolves.toEqual({ paid: false });
    verifier.markPaid('ord-1');
    await expect(verifier.checkPayment(order)).resolves.toEqual({
      paid: true,
      confirmedAmount: '10',
    });
  });

  it('can clear marks', async () => {
    const verifier = new MockPaymentVerifier();
    verifier.markPaid('ord-2');
    expect(verifier.isMarked('ord-2')).toBe(true);
    verifier.clear('ord-2');
    expect(verifier.isMarked('ord-2')).toBe(false);
  });
});
