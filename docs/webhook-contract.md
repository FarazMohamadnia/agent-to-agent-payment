# Provider webhook contract

When an order payment is confirmed, the platform POSTs to the listing's `providerWebhookUrl`.

## Headers

| Header | Value |
|---|---|
| `Content-Type` | `application/json` |
| `X-Signature` | `sha256=<hex HMAC-SHA256 of the raw request body using providerWebhookSecret>` |

## Body

```json
{
  "event": "order.paid",
  "orderId": "uuid",
  "listingId": "uuid",
  "buyerDeliveryDomain": "https://buyer.example/inbox",
  "amount": "5",
  "currency": "USDT",
  "timestamp": "2026-09-12T21:00:00.000Z",
  "confirmationToken": "<JWT confirmation>"
}
```

## Delivery behavior

- Timeout per attempt: `WEBHOOK_TIMEOUT_MS` (default 5000)
- Retries: up to `WEBHOOK_MAX_ATTEMPTS` (default 3) with exponential backoff
- Each attempt is stored in `WebhookDeliveryLog`
- Providers should also poll `GET /api/orders/:id/status` before delivering to the buyer

## Expected Provider behavior after verification

1. Verify `X-Signature` (see sample below).
2. Optionally confirm `status === "paid"` via the status API.
3. Deliver the purchased data/access **directly** to `buyerDeliveryDomain` (outside this platform).

## Node.js signature verification sample

```js
const crypto = require('crypto');

function verifySignature(secret, rawBody, signatureHeader) {
  const digest = crypto.createHmac('sha256', secret).update(rawBody, 'utf8').digest('hex');
  const expected = `sha256=${digest}`;
  const a = Buffer.from(expected);
  const b = Buffer.from(signatureHeader || '');
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

// Express example — must use raw body string used for HMAC
app.post('/hooks/payment', express.raw({ type: 'application/json' }), (req, res) => {
  const rawBody = req.body.toString('utf8');
  const signature = req.get('X-Signature');
  if (!verifySignature(process.env.PROVIDER_WEBHOOK_SECRET, rawBody, signature)) {
    return res.status(401).json({ error: 'invalid signature' });
  }
  const payload = JSON.parse(rawBody);
  // ... enqueue delivery to payload.buyerDeliveryDomain
  res.json({ ok: true });
});
```

> Important: HMAC must be computed over the **exact raw body bytes/string** received, not a re-serialized JSON object.
