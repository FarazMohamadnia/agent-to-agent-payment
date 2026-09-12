import { signHmacSha256, verifyHmacSha256 } from '../../src/utils/hmac';

describe('HMAC helpers', () => {
  const secret = 'provider-webhook-secret';
  const body = JSON.stringify({ event: 'order.paid', orderId: 'abc' });

  it('signs with sha256= prefix', () => {
    const sig = signHmacSha256(secret, body);
    expect(sig.startsWith('sha256=')).toBe(true);
    expect(sig.length).toBeGreaterThan(10);
  });

  it('verifies a valid signature', () => {
    const sig = signHmacSha256(secret, body);
    expect(verifyHmacSha256(secret, body, sig)).toBe(true);
  });

  it('rejects a tampered body', () => {
    const sig = signHmacSha256(secret, body);
    expect(verifyHmacSha256(secret, body + 'x', sig)).toBe(false);
  });

  it('rejects a wrong secret', () => {
    const sig = signHmacSha256(secret, body);
    expect(verifyHmacSha256('other', body, sig)).toBe(false);
  });
});
