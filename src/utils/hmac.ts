import crypto from 'crypto';

export function signHmacSha256(secret: string, rawBody: string): string {
  const digest = crypto.createHmac('sha256', secret).update(rawBody, 'utf8').digest('hex');
  return `sha256=${digest}`;
}

export function verifyHmacSha256(secret: string, rawBody: string, signature: string): boolean {
  const expected = signHmacSha256(secret, rawBody);
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}
