import { OrderStatus, Role } from '@prisma/client';
import { prisma } from '../db/prisma';
import { env } from '../config/env';
import { AppError } from '../utils/errors';
import { generatePaymentReference } from '../utils/ids';
import { getPaymentVerifier } from '../payments';
import { issueConfirmationToken } from './confirmationService';
import { deliverProviderWebhook } from './webhookService';
import { AuthUser } from '../middleware/auth';

function serializeOrder(order: {
  id: string;
  listingId: string;
  buyerId: string | null;
  buyerDeliveryDomain: string;
  amount: { toString(): string };
  currency: string;
  paymentReference: string;
  status: OrderStatus;
  confirmationToken: string | null;
  createdAt: Date;
  paidAt: Date | null;
  expiresAt: Date;
}) {
  return {
    id: order.id,
    listingId: order.listingId,
    buyerId: order.buyerId,
    buyerDeliveryDomain: order.buyerDeliveryDomain,
    amount: order.amount.toString(),
    currency: order.currency,
    paymentReference: order.paymentReference,
    status: order.status,
    confirmationToken: order.confirmationToken,
    createdAt: order.createdAt,
    paidAt: order.paidAt,
    expiresAt: order.expiresAt,
  };
}

export async function createOrder(
  buyerId: string,
  listingId: string,
  buyerDeliveryDomain: string,
) {
  const listing = await prisma.listing.findFirst({
    where: { id: listingId, isActive: true },
  });
  if (!listing) {
    throw new AppError(404, 'LISTING_NOT_FOUND', 'Active listing not found');
  }

  const expiresAt = new Date(Date.now() + env.ORDER_EXPIRY_MINUTES * 60 * 1000);
  const order = await prisma.order.create({
    data: {
      listingId: listing.id,
      buyerId,
      buyerDeliveryDomain,
      amount: listing.price,
      currency: listing.currency,
      paymentReference: generatePaymentReference(),
      status: OrderStatus.pending_payment,
      expiresAt,
    },
  });

  return {
    id: order.id,
    listingId: order.listingId,
    paymentReference: order.paymentReference,
    amount: order.amount.toString(),
    currency: order.currency,
    status: order.status,
    expiresAt: order.expiresAt,
    buyerDeliveryDomain: order.buyerDeliveryDomain,
  };
}

async function expireIfNeeded(orderId: string) {
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) return null;
  if (
    order.status === OrderStatus.pending_payment &&
    order.expiresAt.getTime() < Date.now()
  ) {
    return prisma.order.update({
      where: { id: orderId },
      data: { status: OrderStatus.expired },
    });
  }
  return order;
}

export async function getOrderStatus(orderId: string, user: AuthUser) {
  const existing = await prisma.order.findUnique({
    where: { id: orderId },
    include: { listing: true },
  });
  if (!existing) {
    throw new AppError(404, 'ORDER_NOT_FOUND', 'Order not found');
  }

  await expireIfNeeded(orderId);

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { listing: true },
  });
  if (!order) {
    throw new AppError(404, 'ORDER_NOT_FOUND', 'Order not found');
  }

  const isBuyer = order.buyerId === user.id;
  const isProvider = order.listing.providerId === user.id;
  const isAdmin = user.role === Role.ADMIN;

  if (!isBuyer && !isProvider && !isAdmin) {
    throw new AppError(403, 'FORBIDDEN', 'Not authorized to view this order');
  }

  return serializeOrder(order);
}

export async function verifyPayment(orderId: string) {
  let order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { listing: true },
  });
  if (!order) {
    throw new AppError(404, 'ORDER_NOT_FOUND', 'Order not found');
  }

  if (order.status === OrderStatus.paid || order.status === OrderStatus.payout_sent) {
    throw new AppError(409, 'ALREADY_PAID', 'Order payment already confirmed');
  }

  if (order.status === OrderStatus.expired) {
    throw new AppError(410, 'ORDER_EXPIRED', 'Order has expired');
  }

  if (order.status === OrderStatus.failed) {
    throw new AppError(409, 'ORDER_FAILED', 'Order is in failed state');
  }

  if (order.expiresAt.getTime() < Date.now()) {
    order = await prisma.order.update({
      where: { id: orderId },
      data: { status: OrderStatus.expired },
      include: { listing: true },
    });
    throw new AppError(410, 'ORDER_EXPIRED', 'Order has expired');
  }

  const verifier = getPaymentVerifier();
  const check = await verifier.checkPayment(order);

  if (!check.paid) {
    return {
      paid: false,
      order: serializeOrder(order),
    };
  }

  const timestamp = new Date().toISOString();
  const confirmationToken = issueConfirmationToken({
    orderId: order.id,
    listingId: order.listingId,
    buyerDeliveryDomain: order.buyerDeliveryDomain,
    amount: order.amount.toString(),
    currency: order.currency,
    timestamp,
  });

  const updated = await prisma.order.update({
    where: { id: order.id },
    data: {
      status: OrderStatus.paid,
      paidAt: new Date(),
      confirmationToken,
    },
    include: { listing: true },
  });

  // Fire-and-await webhook so tests can assert delivery logs; failures are logged, not fatal
  await deliverProviderWebhook(
    updated.id,
    updated.listing.providerWebhookUrl,
    updated.listing.providerWebhookSecret,
    {
      event: 'order.paid',
      orderId: updated.id,
      listingId: updated.listingId,
      buyerDeliveryDomain: updated.buyerDeliveryDomain,
      amount: updated.amount.toString(),
      currency: updated.currency,
      timestamp,
      confirmationToken,
    },
  );

  return {
    paid: true,
    order: serializeOrder(updated),
  };
}

export async function listAllOrders() {
  const orders = await prisma.order.findMany({
    orderBy: { createdAt: 'desc' },
    include: { listing: { select: { serviceName: true, providerId: true } } },
  });
  return orders.map((o) => ({
    ...serializeOrder(o),
    listing: o.listing,
  }));
}

export async function markPayoutSent(orderId: string) {
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) {
    throw new AppError(404, 'ORDER_NOT_FOUND', 'Order not found');
  }
  if (order.status !== OrderStatus.paid) {
    throw new AppError(
      409,
      'INVALID_STATUS',
      'Only paid orders can be marked as payout_sent',
    );
  }

  const updated = await prisma.order.update({
    where: { id: orderId },
    data: { status: OrderStatus.payout_sent },
  });
  return serializeOrder(updated);
}
