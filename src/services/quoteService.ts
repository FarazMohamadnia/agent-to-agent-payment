import { prisma } from '../db/prisma';
import { AppError } from '../utils/errors';
import { decimalStr } from '../utils/agentHelpers';

const DEFAULT_TTL_SEC = 300;

export async function createQuote(params: {
  buyerAgentId: string;
  sellerAgentId: string;
  listingId: string;
  quantity: number;
  /** Optional negotiated unit price override (deterministic demo). */
  negotiatedPrice?: string;
}) {
  const listing = await prisma.listing.findFirst({
    where: { id: params.listingId, isActive: true, agentId: params.sellerAgentId },
  });
  if (!listing) {
    throw new AppError(404, 'LISTING_NOT_FOUND', 'Active listing for seller not found');
  }

  const buyer = await prisma.agent.findUnique({ where: { id: params.buyerAgentId } });
  const seller = await prisma.agent.findUnique({ where: { id: params.sellerAgentId } });
  if (!buyer || buyer.type !== 'BUYER') {
    throw new AppError(400, 'INVALID_BUYER', 'Buyer agent required');
  }
  if (!seller || seller.type !== 'SELLER') {
    throw new AppError(400, 'INVALID_SELLER', 'Seller agent required');
  }

  const unit = params.negotiatedPrice != null ? Number(params.negotiatedPrice) : Number(listing.price.toString());
  if (!(unit >= 0)) {
    throw new AppError(400, 'INVALID_PRICE', 'Invalid quote price');
  }

  // Demo negotiation: accept 0.08 when list is 0.10 for weather (deterministic)
  const price = unit;

  const quote = await prisma.quote.create({
    data: {
      buyerAgentId: buyer.id,
      sellerAgentId: seller.id,
      listingId: listing.id,
      price: price.toFixed(2),
      currency: listing.currency,
      quantity: params.quantity,
      status: 'offered',
      expiresAt: new Date(Date.now() + DEFAULT_TTL_SEC * 1000),
    },
  });

  return serializeQuote(quote);
}

export async function negotiateQuote(quoteId: string, counterPrice: string) {
  const quote = await prisma.quote.findUnique({ where: { id: quoteId } });
  if (!quote) throw new AppError(404, 'QUOTE_NOT_FOUND', 'Quote not found');
  assertQuoteActive(quote);

  const listed = Number(quote.price.toString());
  const counter = Number(counterPrice);
  // Deterministic: accept if counter >= 80% of listed (rounded to cents)
  const floor = Number((listed * 0.8).toFixed(2));
  const accepted = counter > 0 && counter >= floor;
  if (!accepted) {
    const rejected = await prisma.quote.update({
      where: { id: quoteId },
      data: { status: 'rejected' },
    });
    return { accepted: false, quote: serializeQuote(rejected) };
  }

  const updated = await prisma.quote.update({
    where: { id: quoteId },
    data: { price: counter.toFixed(2), status: 'offered' },
  });
  return { accepted: true, quote: serializeQuote(updated) };
}

export async function getQuote(quoteId: string) {
  const quote = await prisma.quote.findUnique({ where: { id: quoteId } });
  if (!quote) throw new AppError(404, 'QUOTE_NOT_FOUND', 'Quote not found');
  return serializeQuote(quote);
}

export function assertQuoteActive(quote: {
  status: string;
  expiresAt: Date;
}): void {
  if (quote.status === 'rejected' || quote.status === 'accepted' || quote.status === 'expired') {
    throw new AppError(409, 'QUOTE_INACTIVE', `Quote is ${quote.status}`);
  }
  if (quote.expiresAt.getTime() < Date.now()) {
    throw new AppError(410, 'QUOTE_EXPIRED', 'Quote has expired');
  }
}

export async function markQuoteAccepted(quoteId: string) {
  return prisma.quote.update({
    where: { id: quoteId },
    data: { status: 'accepted' },
  });
}

export async function expireQuoteIfNeeded(quoteId: string) {
  const quote = await prisma.quote.findUnique({ where: { id: quoteId } });
  if (!quote) return null;
  if (quote.status === 'offered' && quote.expiresAt.getTime() < Date.now()) {
    return prisma.quote.update({
      where: { id: quoteId },
      data: { status: 'expired' },
    });
  }
  return quote;
}

function serializeQuote(quote: {
  id: string;
  buyerAgentId: string;
  sellerAgentId: string;
  listingId: string;
  price: { toString(): string };
  currency: string;
  quantity: number;
  status: string;
  expiresAt: Date;
  createdAt: Date;
}) {
  return {
    id: quote.id,
    buyerAgentId: quote.buyerAgentId,
    sellerAgentId: quote.sellerAgentId,
    listingId: quote.listingId,
    price: decimalStr(quote.price),
    currency: quote.currency,
    quantity: quote.quantity,
    status: quote.status,
    expiresAt: quote.expiresAt.toISOString(),
    expiresIn: Math.max(0, Math.floor((quote.expiresAt.getTime() - Date.now()) / 1000)),
    createdAt: quote.createdAt.toISOString(),
  };
}
