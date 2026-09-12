import { prisma } from '../db/prisma';
import { AppError } from '../utils/errors';
import { generateWebhookSecret } from '../utils/ids';

export interface CreateListingInput {
  serviceName: string;
  description: string;
  providerServerDomain: string;
  price: string;
  currency: string;
  payoutAddress: string;
  providerWebhookUrl: string;
}

export interface UpdateListingInput {
  serviceName?: string;
  description?: string;
  providerServerDomain?: string;
  price?: string;
  currency?: string;
  payoutAddress?: string;
  providerWebhookUrl?: string;
  isActive?: boolean;
}

function toProviderView(listing: {
  id: string;
  providerId: string;
  serviceName: string;
  description: string;
  providerServerDomain: string;
  price: { toString(): string };
  currency: string;
  payoutAddress: string;
  providerWebhookUrl: string;
  providerWebhookSecret: string;
  isActive: boolean;
  createdAt: Date;
}) {
  return {
    id: listing.id,
    providerId: listing.providerId,
    serviceName: listing.serviceName,
    description: listing.description,
    providerServerDomain: listing.providerServerDomain,
    price: listing.price.toString(),
    currency: listing.currency,
    payoutAddress: listing.payoutAddress,
    providerWebhookUrl: listing.providerWebhookUrl,
    // Secret returned once on create so provider can store it; never on public endpoints
    providerWebhookSecret: listing.providerWebhookSecret,
    isActive: listing.isActive,
    createdAt: listing.createdAt,
  };
}

export function toPublicListing(listing: {
  id: string;
  providerId: string;
  serviceName: string;
  description: string;
  providerServerDomain: string;
  price: { toString(): string };
  currency: string;
  isActive: boolean;
  createdAt: Date;
}) {
  return {
    id: listing.id,
    providerId: listing.providerId,
    serviceName: listing.serviceName,
    description: listing.description,
    providerServerDomain: listing.providerServerDomain,
    price: listing.price.toString(),
    currency: listing.currency,
    isActive: listing.isActive,
    createdAt: listing.createdAt,
  };
}

export async function createListing(providerId: string, input: CreateListingInput) {
  const secret = generateWebhookSecret();
  const listing = await prisma.listing.create({
    data: {
      providerId,
      serviceName: input.serviceName,
      description: input.description,
      providerServerDomain: input.providerServerDomain,
      price: input.price,
      currency: input.currency,
      payoutAddress: input.payoutAddress,
      providerWebhookUrl: input.providerWebhookUrl,
      providerWebhookSecret: secret,
      isActive: true,
    },
  });
  return toProviderView(listing);
}

export async function listMine(providerId: string) {
  const listings = await prisma.listing.findMany({
    where: { providerId },
    orderBy: { createdAt: 'desc' },
  });
  return listings.map((l) => ({
    ...toProviderView(l),
    // Do not re-expose secret on list — only at creation time
    providerWebhookSecret: undefined,
  }));
}

export async function updateListing(providerId: string, listingId: string, input: UpdateListingInput) {
  const existing = await prisma.listing.findUnique({ where: { id: listingId } });
  if (!existing) {
    throw new AppError(404, 'LISTING_NOT_FOUND', 'Listing not found');
  }
  if (existing.providerId !== providerId) {
    throw new AppError(403, 'FORBIDDEN', 'You can only update your own listings');
  }

  const listing = await prisma.listing.update({
    where: { id: listingId },
    data: {
      ...(input.serviceName !== undefined && { serviceName: input.serviceName }),
      ...(input.description !== undefined && { description: input.description }),
      ...(input.providerServerDomain !== undefined && {
        providerServerDomain: input.providerServerDomain,
      }),
      ...(input.price !== undefined && { price: input.price }),
      ...(input.currency !== undefined && { currency: input.currency }),
      ...(input.payoutAddress !== undefined && { payoutAddress: input.payoutAddress }),
      ...(input.providerWebhookUrl !== undefined && {
        providerWebhookUrl: input.providerWebhookUrl,
      }),
      ...(input.isActive !== undefined && { isActive: input.isActive }),
    },
  });

  return {
    ...toProviderView(listing),
    providerWebhookSecret: undefined,
  };
}

export async function deactivateListing(providerId: string, listingId: string) {
  const existing = await prisma.listing.findUnique({ where: { id: listingId } });
  if (!existing) {
    throw new AppError(404, 'LISTING_NOT_FOUND', 'Listing not found');
  }
  if (existing.providerId !== providerId) {
    throw new AppError(403, 'FORBIDDEN', 'You can only deactivate your own listings');
  }

  const listing = await prisma.listing.update({
    where: { id: listingId },
    data: { isActive: false },
  });

  return {
    ...toProviderView(listing),
    providerWebhookSecret: undefined,
  };
}

export async function listPublicActive() {
  const listings = await prisma.listing.findMany({
    where: { isActive: true },
    orderBy: { createdAt: 'desc' },
  });
  return listings.map(toPublicListing);
}

export async function getPublicListing(id: string) {
  const listing = await prisma.listing.findFirst({
    where: { id, isActive: true },
  });
  if (!listing) {
    throw new AppError(404, 'LISTING_NOT_FOUND', 'Listing not found');
  }
  return toPublicListing(listing);
}
