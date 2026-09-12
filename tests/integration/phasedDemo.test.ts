import request from 'supertest';
import { AddressInfo } from 'net';
import { createApp } from '../../src/app';
import { resetDatabase } from '../helpers';
import { verifyHmacSha256 } from '../../src/utils/hmac';

describe('Phased agent-to-agent demo flow', () => {
  const app = createApp();
  let server: ReturnType<typeof app.listen>;
  let baseUrl: string;

  beforeAll(async () => {
    await new Promise<void>((resolve) => {
      server = app.listen(0, '127.0.0.1', () => resolve());
    });
    const addr = server.address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${addr.port}`;
  });

  afterAll(async () => {
    await new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
  });

  beforeEach(async () => {
    await resetDatabase();
    await request(app).delete('/api/dev/webhook-sink').expect(200);
  });

  it('runs all architecture phases end-to-end with webhook sink', async () => {
    const stamp = Date.now();
    const password = 'Password123!';
    const webhookUrl = `${baseUrl}/api/dev/webhook-sink`;

    const provider = await request(app)
      .post('/api/auth/register')
      .send({
        email: `provider.phase.${stamp}@demo.local`,
        password,
        role: 'PROVIDER',
      })
      .expect(201);

    const listing = await request(app)
      .post('/api/listings')
      .set('Authorization', `Bearer ${provider.body.token}`)
      .send({
        serviceName: 'Phased Weather Agent',
        description: 'Integration phased listing',
        providerServerDomain: 'https://provider-agent.example.com',
        price: '7.50',
        currency: 'USDT',
        payoutAddress: 'payout-phase',
        providerWebhookUrl: webhookUrl,
      })
      .expect(201);

    const secret = listing.body.listing.providerWebhookSecret as string;
    expect(secret).toBeTruthy();

    const catalog = await request(app).get('/api/public/listings').expect(200);
    const found = catalog.body.listings.find(
      (l: { id: string }) => l.id === listing.body.listing.id,
    );
    expect(found).toBeTruthy();
    expect(found.payoutAddress).toBeUndefined();
    expect(found.providerWebhookSecret).toBeUndefined();

    const buyer = await request(app)
      .post('/api/auth/register')
      .send({
        email: `buyer.phase.${stamp}@demo.local`,
        password,
        role: 'BUYER',
      })
      .expect(201);

    const order = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${buyer.body.token}`)
      .send({
        listingId: listing.body.listing.id,
        buyerDeliveryDomain: 'https://buyer-agent.example.com/inbox',
      })
      .expect(201);

    await request(app).post(`/api/dev/mock-pay/${order.body.order.id}`).expect(200);

    const verify = await request(app)
      .post(`/api/orders/${order.body.order.id}/verify-payment`)
      .set('Authorization', `Bearer ${buyer.body.token}`)
      .expect(200);

    expect(verify.body.paid).toBe(true);
    expect(verify.body.order.status).toBe('paid');
    expect(verify.body.order.confirmationToken).toBeTruthy();

    const status = await request(app)
      .get(`/api/orders/${order.body.order.id}/status`)
      .set('Authorization', `Bearer ${provider.body.token}`)
      .expect(200);
    expect(status.body.order.status).toBe('paid');

    const stranger = await request(app)
      .post('/api/auth/register')
      .send({
        email: `stranger.phase.${stamp}@demo.local`,
        password,
        role: 'BUYER',
      })
      .expect(201);

    await request(app)
      .get(`/api/orders/${order.body.order.id}/status`)
      .set('Authorization', `Bearer ${stranger.body.token}`)
      .expect(403);

    await request(app)
      .post(`/api/orders/${order.body.order.id}/verify-payment`)
      .set('Authorization', `Bearer ${buyer.body.token}`)
      .expect(409);

    const admin = await request(app)
      .post('/api/auth/register')
      .send({
        email: `admin.phase.${stamp}@demo.local`,
        password,
        role: 'ADMIN',
      })
      .expect(201);

    const payout = await request(app)
      .patch(`/api/admin/orders/${order.body.order.id}/payout`)
      .set('Authorization', `Bearer ${admin.body.token}`)
      .expect(200);
    expect(payout.body.order.status).toBe('payout_sent');

    const sink = await request(app).get('/api/dev/webhook-sink').expect(200);
    expect(sink.body.entries.length).toBeGreaterThan(0);
    const hit = sink.body.entries.find(
      (e: { body?: { orderId?: string }; rawBody?: string }) =>
        e.body?.orderId === order.body.order.id ||
        (e.rawBody && e.rawBody.includes(order.body.order.id)),
    );
    expect(hit).toBeTruthy();
    expect(hit.signature).toBeTruthy();
    expect(verifyHmacSha256(secret, hit.rawBody, hit.signature)).toBe(true);

    const logs = await request(app)
      .get('/api/console/webhook-logs')
      .set('Authorization', `Bearer ${provider.body.token}`)
      .expect(200);
    expect(
      logs.body.logs.some(
        (l: { orderId: string; success: boolean }) =>
          l.orderId === order.body.order.id && l.success,
      ),
    ).toBe(true);
  });
});
