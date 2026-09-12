import { prisma } from '../db/prisma';
import { AppError } from '../utils/errors';
import { paymentService } from './paymentService';

function mockWeatherPayload(city: string) {
  return {
    service: 'weather-data',
    city,
    temperature: 31,
    condition: 'Sunny',
    source: 'Demo Weather Agent',
  };
}

function mockCryptoPayload(symbol: string) {
  return {
    service: 'crypto-price',
    symbol,
    price: 112500,
    currency: 'USD',
    source: 'Demo Crypto Agent',
  };
}

function mockTranslationPayload(text: string) {
  return {
    service: 'translation',
    input: text,
    output: `[demo-translated] ${text}`,
    source: 'Demo Translation Agent',
  };
}

export async function deliverService(params: {
  paymentId: string;
  sellerAgentId: string;
  paymentProofToken: string;
  request: { city?: string; symbol?: string; text?: string };
}) {
  const existing = await prisma.serviceDelivery.findUnique({
    where: { paymentId: params.paymentId },
  });
  if (existing) {
    throw new AppError(409, 'ALREADY_DELIVERED', 'Service already delivered for this payment');
  }

  const verification = await paymentService.verifyPaymentProof(
    params.paymentProofToken,
    params.sellerAgentId,
  );

  const payment = await prisma.agentPayment.findUnique({
    where: { id: params.paymentId },
    include: {
      quote: { include: { listing: true } },
      toAgent: true,
    },
  });
  if (!payment?.quote?.listing) {
    throw new AppError(404, 'PAYMENT_NOT_FOUND', 'Payment or listing not found');
  }

  const capability = payment.quote.listing.capability || 'general';
  let payload: Record<string, unknown>;
  if (capability === 'weather-data') {
    payload = mockWeatherPayload(params.request.city || 'Dubai');
  } else if (capability === 'crypto-price') {
    payload = mockCryptoPayload(params.request.symbol || 'BTC');
  } else if (capability === 'translation') {
    payload = mockTranslationPayload(params.request.text || 'Hello');
  } else {
    payload = {
      service: capability,
      message: 'Demo service result',
      source: payment.toAgent.name,
    };
  }

  const delivery = await prisma.serviceDelivery.create({
    data: {
      paymentId: payment.id,
      service: capability,
      payload: JSON.stringify(payload),
      status: 'delivered',
    },
  });

  return {
    delivered: true,
    verification,
    delivery: {
      id: delivery.id,
      paymentId: delivery.paymentId,
      service: delivery.service,
      status: delivery.status,
      result: payload,
      createdAt: delivery.createdAt.toISOString(),
    },
  };
}

export async function rejectDeliveryWithoutPayment(paymentId: string) {
  const payment = await prisma.agentPayment.findUnique({ where: { id: paymentId } });
  if (!payment || payment.status !== 'completed' || !payment.paymentProofToken) {
    throw new AppError(
      403,
      'PAYMENT_REQUIRED',
      'Delivery rejected before payment verification',
    );
  }
}
