import bcrypt from 'bcryptjs';
import { PrismaClient, Role, OrderStatus } from '@prisma/client';
import { generateWebhookSecret, generatePaymentReference } from './utils/ids';

const prisma = new PrismaClient();

async function main() {
  await prisma.webhookDeliveryLog.deleteMany();
  await prisma.order.deleteMany();
  await prisma.listing.deleteMany();
  await prisma.user.deleteMany();

  const passwordHash = await bcrypt.hash('Password123!', 10);

  const provider = await prisma.user.create({
    data: {
      email: 'provider@demo.local',
      passwordHash,
      role: Role.PROVIDER,
    },
  });

  const provider2 = await prisma.user.create({
    data: {
      email: 'provider2@demo.local',
      passwordHash,
      role: Role.PROVIDER,
    },
  });

  const buyer = await prisma.user.create({
    data: {
      email: 'buyer@demo.local',
      passwordHash,
      role: Role.BUYER,
    },
  });

  await prisma.user.create({
    data: {
      email: 'admin@demo.local',
      passwordHash,
      role: Role.ADMIN,
    },
  });

  const listing1 = await prisma.listing.create({
    data: {
      providerId: provider.id,
      serviceName: 'Weather Agent API',
      description: 'Returns structured weather forecasts for a given city.',
      providerServerDomain: 'https://weather-agent.example.com',
      price: '5.00',
      currency: 'USDT',
      payoutAddress: 'TDemoProviderPayoutAddress111',
      providerWebhookUrl: 'https://weather-agent.example.com/webhooks/payment',
      providerWebhookSecret: generateWebhookSecret(),
      isActive: true,
    },
  });

  const listing2 = await prisma.listing.create({
    data: {
      providerId: provider2.id,
      serviceName: 'Translation Agent',
      description: 'Translates text between supported languages.',
      providerServerDomain: 'https://translate-agent.example.com',
      price: '2.50',
      currency: 'USD',
      payoutAddress: 'bank:REF-DEMO-222',
      providerWebhookUrl: 'https://translate-agent.example.com/hooks/paid',
      providerWebhookSecret: generateWebhookSecret(),
      isActive: true,
    },
  });

  await prisma.order.create({
    data: {
      listingId: listing1.id,
      buyerId: buyer.id,
      buyerDeliveryDomain: 'https://buyer-agent.example.com/inbox',
      amount: listing1.price,
      currency: listing1.currency,
      paymentReference: generatePaymentReference(),
      status: OrderStatus.pending_payment,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    },
  });

  console.log('Seed complete.');
  console.log({
    accounts: {
      provider: 'provider@demo.local / Password123!',
      provider2: 'provider2@demo.local / Password123!',
      buyer: 'buyer@demo.local / Password123!',
      admin: 'admin@demo.local / Password123!',
    },
    listings: [listing1.id, listing2.id],
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
