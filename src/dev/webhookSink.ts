import { Request, Response } from 'express';

export interface SinkEntry {
  at: string;
  signature: string | null;
  body: unknown;
  rawBody: string;
}

const webhookSink: SinkEntry[] = [];
const SINK_MAX = 50;

export function handleWebhookSinkPost(req: Request, res: Response): void {
  const rawBody = Buffer.isBuffer(req.body)
    ? req.body.toString('utf8')
    : typeof req.body === 'string'
      ? req.body
      : JSON.stringify(req.body ?? {});

  let body: unknown = rawBody;
  try {
    body = JSON.parse(rawBody);
  } catch {
    /* keep raw string */
  }

  webhookSink.unshift({
    at: new Date().toISOString(),
    signature: (req.header('X-Signature') as string) || null,
    body,
    rawBody,
  });
  if (webhookSink.length > SINK_MAX) webhookSink.length = SINK_MAX;
  res.status(200).json({ ok: true, received: true });
}

export function handleWebhookSinkList(_req: Request, res: Response): void {
  res.json({ entries: webhookSink.slice(0, 20) });
}

export function handleWebhookSinkClear(_req: Request, res: Response): void {
  webhookSink.length = 0;
  res.json({ ok: true });
}
