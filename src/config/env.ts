import { config } from 'dotenv';
import { z } from 'zod';

config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(3000),
  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z.string().min(16),
  JWT_EXPIRES_IN: z.string().default('2h'),
  BCRYPT_COST: z.coerce.number().int().min(10).default(10),
  CORS_ORIGINS: z.string().default('*'),
  ORDER_EXPIRY_MINUTES: z.coerce.number().int().positive().default(60),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(900_000),
  RATE_LIMIT_AUTH_MAX: z.coerce.number().int().positive().default(20),
  RATE_LIMIT_ORDERS_MAX: z.coerce.number().int().positive().default(30),
  LOG_LEVEL: z.string().default('info'),
  WEBHOOK_TIMEOUT_MS: z.coerce.number().int().positive().default(5_000),
  WEBHOOK_MAX_ATTEMPTS: z.coerce.number().int().positive().default(3),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('Invalid environment configuration:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;

export const isProduction = env.NODE_ENV === 'production';
export const isTest = env.NODE_ENV === 'test';
