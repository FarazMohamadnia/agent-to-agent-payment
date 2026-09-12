import { prisma } from '../db/prisma';
import { signHmacSha256 } from '../utils/hmac';
import { logger } from '../config/logger';
import { env } from '../config/env';

const BASE_DELAY_MS = 100;

export interface WebhookPayload {
  event: 'order.paid';
  orderId: string;
  listingId: string;
  buyerDeliveryDomain: string;
  amount: string;
  currency: string;
  timestamp: string;
  confirmationToken: string;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function attemptDelivery(
  targetUrl: string,
  rawBody: string,
  signature: string,
): Promise<{ httpStatus: number | null; responseSnippet: string | null; success: boolean }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), env.WEBHOOK_TIMEOUT_MS);

  try {
    const res = await fetch(targetUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Signature': signature,
      },
      body: rawBody,
      signal: controller.signal,
    });
    const text = await res.text();
    return {
      httpStatus: res.status,
      responseSnippet: text.slice(0, 500),
      success: res.status >= 200 && res.status < 300,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown delivery error';
    return { httpStatus: null, responseSnippet: message.slice(0, 500), success: false };
  } finally {
    clearTimeout(timer);
  }
}

export async function deliverProviderWebhook(
  orderId: string,
  targetUrl: string,
  webhookSecret: string,
  payload: WebhookPayload,
): Promise<void> {
  const rawBody = JSON.stringify(payload);
  const signature = signHmacSha256(webhookSecret, rawBody);
  const maxAttempts = env.WEBHOOK_MAX_ATTEMPTS;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const result = await attemptDelivery(targetUrl, rawBody, signature);

    await prisma.webhookDeliveryLog.create({
      data: {
        orderId,
        targetUrl,
        httpStatus: result.httpStatus,
        responseSnippet: result.responseSnippet,
        success: result.success,
      },
    });

    if (result.success) {
      logger.info({ orderId, attempt, targetUrl }, 'Provider webhook delivered');
      return;
    }

    logger.warn({ orderId, attempt, targetUrl, result }, 'Provider webhook delivery failed');
    if (attempt < maxAttempts) {
      await sleep(BASE_DELAY_MS * Math.pow(2, attempt - 1));
    }
  }
}
