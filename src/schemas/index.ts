import { z } from 'zod';

export const registerSchema = z
  .object({
    email: z.string().email(),
    password: z.string().min(8).max(128),
    role: z.enum(['PROVIDER', 'BUYER', 'ADMIN']),
  })
  .strict();

export const loginSchema = z
  .object({
    email: z.string().email(),
    password: z.string().min(1),
  })
  .strict();

export const createListingSchema = z
  .object({
    serviceName: z.string().min(1).max(200),
    description: z.string().min(1).max(5000),
    providerServerDomain: z.string().min(1).max(500),
    price: z.union([z.string(), z.number()]).transform((v) => String(v)),
    currency: z.string().min(1).max(16),
    payoutAddress: z.string().min(1).max(500),
    providerWebhookUrl: z.string().url(),
  })
  .strict();

export const updateListingSchema = z
  .object({
    serviceName: z.string().min(1).max(200).optional(),
    description: z.string().min(1).max(5000).optional(),
    providerServerDomain: z.string().min(1).max(500).optional(),
    price: z
      .union([z.string(), z.number()])
      .transform((v) => String(v))
      .optional(),
    currency: z.string().min(1).max(16).optional(),
    payoutAddress: z.string().min(1).max(500).optional(),
    providerWebhookUrl: z.string().url().optional(),
    isActive: z.boolean().optional(),
  })
  .strict();

export const createOrderSchema = z
  .object({
    listingId: z.string().uuid(),
    buyerDeliveryDomain: z.string().min(1).max(500),
  })
  .strict();

export const idParamSchema = z
  .object({
    id: z.string().uuid(),
  })
  .strict();

export const orderIdParamSchema = z
  .object({
    orderId: z.string().uuid(),
  })
  .strict();
