import http from 'http';
import request from 'supertest';
import { createApp } from '../../src/app';
import { resetDatabase } from '../helpers';
import { prisma } from '../../src/db/prisma';
import { verifyHmacSha256 } from '../../src/utils/hmac';
import { AddressInfo } from 'net';

describe('Integration: happy path + failure paths', () => {
  const app = createApp();
  let webhookServer: http.Server;
  let webhookUrl: string;
  let receivedBodies: { raw: string; signature: string | undefined }[] = [];

  beforeAll(async () => {
    receivedBodies = [];
    webhookServer = http.createServer((req, res) => {
      const chunks: Buffer[] = [];
      req.on('data', (c) => chunks.push(c));
      req.on('end', () => {
        const raw = Buffer.concat(chunks).toString('utf8');
        receivedBodies.push({
          raw,
          signature: req.headers['x-signature'] as string | undefined,
        });
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true }));
      });
    });
    await new Promise<void>((resolve) => {
      webhookServer.listen(0, '127.0.0.1', () => resolve());
    });
    const addr = webhookServer.address() as AddressInfo;
    webhookUrl = `http://127.0.0.1:${addr.port}/hook`;
  });

  afterAll(async () => {
    await new Promise<void>((resolve, reject) => {
      webhookServer.close((err) => (err ? reject(err) : resolve()));
    });
  });

  beforeEach(async () => {
    await resetDatabase();
    receivedBodies = [];
  });

  it('runs full happy path: register → listing → order → mock-pay → verify → webhook', async () => {
    const providerReg = await request(app)
      .post('/api/auth/register')
      .send({ email: 'provider@test.com', password: 'Password123!', role: 'PROVIDER' })
      .expect(201);
    const providerToken = providerReg.body.token as string;

    const listingRes = await request(app)
      .post('/api/listings')
      .set('Authorization', `Bearer ${providerToken}`)
      .send({
        serviceName: 'Demo API',
        description: 'Demo description',
        providerServerDomain: 'https://provider.test',
        price: '10.00',
        currency: 'USDT',
        payoutAddress: 'TXYZ',
        providerWebhookUrl: webhookUrl,
      })
      .expect(201);

    const listingId = listingRes.body.listing.id as string;
    const webhookSecret = listingRes.body.listing.providerWebhookSecret as string;
    expect(webhookSecret).toBeTruthy();

    const publicRes = await request(app).get('/api/public/listings').expect(200);
    expect(publicRes.body.listings).toHaveLength(1);
    expect(publicRes.body.listings[0].payoutAddress).toBeUndefined();
    expect(publicRes.body.listings[0].providerWebhookSecret).toBeUndefined();

    const buyerReg = await request(app)
      .post('/api/auth/register')
      .send({ email: 'buyer@test.com', password: 'Password123!', role: 'BUYER' })
      .expect(201);
    const buyerToken = buyerReg.body.token as string;

    const orderRes = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${buyerToken}`)
      .send({
        listingId,
        buyerDeliveryDomain: 'https://buyer.test/inbox',
      })
      .expect(201);

    const orderId = orderRes.body.order.id as string;
    expect(orderRes.body.order.paymentReference).toMatch(/^pay_/);

    await request(app).post(`/api/dev/mock-pay/${orderId}`).expect(200);

    const verifyRes = await request(app)
      .post(`/api/orders/${orderId}/verify-payment`)
      .set('Authorization', `Bearer ${buyerToken}`)
      .expect(200);

    expect(verifyRes.body.paid).toBe(true);
    expect(verifyRes.body.order.status).toBe('paid');
    expect(verifyRes.body.order.confirmationToken).toBeTruthy();

    // Allow webhook attempt(s) to finish (verify awaits delivery)
    expect(receivedBodies.length).toBeGreaterThanOrEqual(1);
    const delivery = receivedBodies[0];
    expect(delivery.signature).toBeTruthy();
    expect(verifyHmacSha256(webhookSecret, delivery.raw, delivery.signature!)).toBe(true);
    const payload = JSON.parse(delivery.raw);
    expect(payload.event).toBe('order.paid');
    expect(payload.buyerDeliveryDomain).toBe('https://buyer.test/inbox');

    const logs = await prisma.webhookDeliveryLog.findMany({ where: { orderId } });
    expect(logs.some((l) => l.success)).toBe(true);

    const statusRes = await request(app)
      .get(`/api/orders/${orderId}/status`)
      .set('Authorization', `Bearer ${providerToken}`)
      .expect(200);
    expect(statusRes.body.order.status).toBe('paid');

    const adminReg = await request(app)
      .post('/api/auth/register')
      .send({ email: 'admin@test.com', password: 'Password123!', role: 'ADMIN' })
      .expect(201);

    const payoutRes = await request(app)
      .patch(`/api/admin/orders/${orderId}/payout`)
      .set('Authorization', `Bearer ${adminReg.body.token}`)
      .expect(200);
    expect(payoutRes.body.order.status).toBe('payout_sent');
  });

  it('rejects invalid input and unauthorized access', async () => {
    await request(app)
      .post('/api/auth/register')
      .send({ email: 'bad', password: 'short', role: 'BUYER' })
      .expect(400)
      .expect((res) => {
        expect(res.body.error.code).toBe('VALIDATION_ERROR');
      });

    const p1 = await request(app)
      .post('/api/auth/register')
      .send({ email: 'p1@test.com', password: 'Password123!', role: 'PROVIDER' })
      .expect(201);
    const p2 = await request(app)
      .post('/api/auth/register')
      .send({ email: 'p2@test.com', password: 'Password123!', role: 'PROVIDER' })
      .expect(201);

    const listing = await request(app)
      .post('/api/listings')
      .set('Authorization', `Bearer ${p1.body.token}`)
      .send({
        serviceName: 'A',
        description: 'B',
        providerServerDomain: 'https://a.test',
        price: '1',
        currency: 'USD',
        payoutAddress: 'x',
        providerWebhookUrl: webhookUrl,
      })
      .expect(201);

    await request(app)
      .patch(`/api/listings/${listing.body.listing.id}`)
      .set('Authorization', `Bearer ${p2.body.token}`)
      .send({ serviceName: 'Stolen' })
      .expect(403);

    const stranger = await request(app)
      .post('/api/auth/register')
      .send({ email: 'stranger@test.com', password: 'Password123!', role: 'BUYER' })
      .expect(201);

    const buyer = await request(app)
      .post('/api/auth/register')
      .send({ email: 'b@test.com', password: 'Password123!', role: 'BUYER' })
      .expect(201);

    const order = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${buyer.body.token}`)
      .send({
        listingId: listing.body.listing.id,
        buyerDeliveryDomain: 'https://buyer.test/inbox',
      })
      .expect(201);

    await request(app)
      .get(`/api/orders/${order.body.order.id}/status`)
      .set('Authorization', `Bearer ${stranger.body.token}`)
      .expect(403);

    // Provider cannot create orders
    await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${p1.body.token}`)
      .send({
        listingId: listing.body.listing.id,
        buyerDeliveryDomain: 'https://buyer.test/inbox',
      })
      .expect(403);
  });

  it('rejects expired order payment verification', async () => {
    const provider = await request(app)
      .post('/api/auth/register')
      .send({ email: 'p3@test.com', password: 'Password123!', role: 'PROVIDER' })
      .expect(201);

    const listing = await request(app)
      .post('/api/listings')
      .set('Authorization', `Bearer ${provider.body.token}`)
      .send({
        serviceName: 'Exp',
        description: 'Exp',
        providerServerDomain: 'https://exp.test',
        price: '1',
        currency: 'USD',
        payoutAddress: 'x',
        providerWebhookUrl: webhookUrl,
      })
      .expect(201);

    const buyer = await request(app)
      .post('/api/auth/register')
      .send({ email: 'b3@test.com', password: 'Password123!', role: 'BUYER' })
      .expect(201);

    const order = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${buyer.body.token}`)
      .send({
        listingId: listing.body.listing.id,
        buyerDeliveryDomain: 'https://buyer.test/inbox',
      })
      .expect(201);

    await prisma.order.update({
      where: { id: order.body.order.id },
      data: { expiresAt: new Date(Date.now() - 5_000) },
    });

    await request(app).post(`/api/dev/mock-pay/${order.body.order.id}`).expect(200);

    await request(app)
      .post(`/api/orders/${order.body.order.id}/verify-payment`)
      .set('Authorization', `Bearer ${buyer.body.token}`)
      .expect(410);
  });

  it('documents invalid webhook signature rejection for providers', () => {
    const secret = 'abc123';
    const body = '{"event":"order.paid"}';
    const badSig = 'sha256=deadbeef';
    expect(verifyHmacSha256(secret, body, badSig)).toBe(false);
  });
});
