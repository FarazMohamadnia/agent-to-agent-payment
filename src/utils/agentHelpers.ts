import { createHash, randomBytes } from 'crypto';

export function parseCapabilities(raw: string): string[] {
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

export function stringifyCapabilities(caps: string[]): string {
  return JSON.stringify(caps);
}

export function mockTxHash(seed?: string): string {
  const material = seed ?? randomBytes(16).toString('hex');
  const digest = createHash('sha256').update(material).digest('hex').slice(0, 8);
  return `0xmock_${digest}`;
}

export function decimalStr(value: { toString(): string } | string | number): string {
  return Number(value.toString()).toFixed(2);
}
