import { Role, OrderStatus } from '@prisma/client';
import { registerUser } from '../../src/services/authService';
import * as listingService from '../../src/services/listingService';
import * as orderService from '../../src/services/orderService';
import { mockPaymentVerifier } from '../../src/payments/MockPaymentVerifier';
import { resetDatabase } from '../helpers';
import { prisma } from '../../src/db/prisma';
import { AppError } from '../../src/utils/errors';

const baseListing = {
  serviceName: 'Order Service',
  description: 'desc',
  providerServerDomain: 'https://provider.example.com',
  price: '3.50',
  currency: 'USD',
  payoutAddress: 'addr',
  providerWebhookUrl: 'http://127.0.0.1:9/webhook-unreachable',
};

describe('Order service', () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  async function setupActors() {
    const provider = await registerUser('prov@ex.com', 'Password123!', Role.PROVIDER);
    const buyer = await registerUser('buy@ex.com', 'Password123!', Role.BUYER);
    const listing = await listingService.createListing(provider.user.id, baseListing);
    return { provider, buyer, listing };
  }

  it('creates an order in pending_payment', async () => {
    const { buyer, listing } = await setupActors();
    const order = await orderService.createOrder(
      buyer.user.id,
      listing.id,
      'https://buyer.example/inbox',
    );
    expect(order.status).toBe(OrderStatus.pending_payment);
    expect(order.paymentReference).toMatch(/^pay_/);
    expect(order.amount).toBe('3.5');
  });

  it('transitions to paid after mock pay + verify', async () => {
    const { buyer, listing } = await setupActors();
    const order = await orderService.createOrder(
      buyer.user.id,
      listing.id,
      'https://buyer.example/inbox',
    );
    mockPaymentVerifier.markPaid(order.id);
    const result = await orderService.verifyPayment(order.id);
    expect(result.paid).toBe(true);
    expect(result.order.status).toBe(OrderStatus.paid);
    expect(result.order.confirmationToken).toBeTruthy();
  });

  it('rejects double payment confirmation', async () => {
    const { buyer, listing } = await setupActors();
    const order = await orderService.createOrder(
      buyer.user.id,
      listing.id,
      'https://buyer.example/inbox',
    );
    mockPaymentVerifier.markPaid(order.id);
    await orderService.verifyPayment(order.id);
    await expect(orderService.verifyPayment(order.id)).rejects.toMatchObject({
      code: 'ALREADY_PAID',
    } as Partial<AppError>);
  });

  it('rejects expired orders', async () => {
    const { buyer, listing } = await setupActors();
    const order = await orderService.createOrder(
      buyer.user.id,
      listing.id,
      'https://buyer.example/inbox',
    );
    await prisma.order.update({
      where: { id: order.id },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });
    mockPaymentVerifier.markPaid(order.id);
    await expect(orderService.verifyPayment(order.id)).rejects.toMatchObject({
      code: 'ORDER_EXPIRED',
    } as Partial<AppError>);
  });

  it('marks payout_sent only from paid', async () => {
    const { buyer, listing } = await setupActors();
    const order = await orderService.createOrder(
      buyer.user.id,
      listing.id,
      'https://buyer.example/inbox',
    );
    await expect(orderService.markPayoutSent(order.id)).rejects.toMatchObject({
      code: 'INVALID_STATUS',
    } as Partial<AppError>);

    mockPaymentVerifier.markPaid(order.id);
    await orderService.verifyPayment(order.id);
    const updated = await orderService.markPayoutSent(order.id);
    expect(updated.status).toBe(OrderStatus.payout_sent);
  });
});
