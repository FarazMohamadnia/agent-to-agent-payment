import bcrypt from 'bcryptjs';
import { PrismaClient, Role, OrderStatus, AgentType } from '@prisma/client';
import { generateWebhookSecret, generatePaymentReference } from './utils/ids';
import { stringifyCapabilities } from './utils/agentHelpers';

const prisma = new PrismaClient();

async function main() {
  await prisma.serviceDelivery.deleteMany();
  await prisma.agentPayment.deleteMany();
  await prisma.quote.deleteMany();
  await prisma.webhookDeliveryLog.deleteMany();
  await prisma.order.deleteMany();
  await prisma.listing.deleteMany();
  await prisma.agent.deleteMany();
  await prisma.user.deleteMany();

  const passwordHash = await bcrypt.hash('Password123!', 10);

  const provider = await prisma.user.create({
    data: { email: 'provider@demo.local', passwordHash, role: Role.PROVIDER },
  });
  const provider2 = await prisma.user.create({
    data: { email: 'provider2@demo.local', passwordHash, role: Role.PROVIDER },
  });
  const provider3 = await prisma.user.create({
    data: { email: 'provider3@demo.local', passwordHash, role: Role.PROVIDER },
  });
  const buyer = await prisma.user.create({
    data: { email: 'buyer@demo.local', passwordHash, role: Role.BUYER },
  });
  await prisma.user.create({
    data: { email: 'admin@demo.local', passwordHash, role: Role.ADMIN },
  });

  // --- V2 Agents ---
  const research = await prisma.agent.create({
    data: {
      name: 'Research Agent',
      type: AgentType.BUYER,
      description: 'Discovers services, compares prices, pays within spending policy.',
      walletAddress: '0xDemoBuyerAgent',
      balance: '10.00',
      currency: 'USDC',
      capabilities: stringifyCapabilities(['discovery', 'research']),
      maxTransaction: '1.00',
      dailyLimit: '5.00',
      dailySpent: '0.00',
      allowedToken: 'USDC',
      status: 'active',
    },
  });

  const weatherA = await prisma.agent.create({
    data: {
      name: 'Weather Data Agent A',
      type: AgentType.SELLER,
      description: 'Simulated weather data service (cheapest).',
      walletAddress: '0xDemoWeatherA',
      balance: '0.00',
      currency: 'USDC',
      capabilities: stringifyCapabilities(['weather-data']),
      status: 'active',
    },
  });

  const weatherB = await prisma.agent.create({
    data: {
      name: 'Weather Data Agent B',
      type: AgentType.SELLER,
      description: 'Simulated weather data service (mid price).',
      walletAddress: '0xDemoWeatherB',
      balance: '0.00',
      currency: 'USDC',
      capabilities: stringifyCapabilities(['weather-data']),
      status: 'active',
    },
  });

  const weatherC = await prisma.agent.create({
    data: {
      name: 'Weather Data Agent C',
      type: AgentType.SELLER,
      description: 'Simulated weather data service (premium).',
      walletAddress: '0xDemoWeatherC',
      balance: '0.00',
      currency: 'USDC',
      capabilities: stringifyCapabilities(['weather-data']),
      status: 'active',
    },
  });

  const cryptoAgent = await prisma.agent.create({
    data: {
      name: 'Crypto Price Agent',
      type: AgentType.SELLER,
      description: 'Simulated crypto price quotes.',
      walletAddress: '0xDemoCrypto',
      balance: '0.00',
      currency: 'USDC',
      capabilities: stringifyCapabilities(['crypto-price']),
      status: 'active',
    },
  });

  const translationAgent = await prisma.agent.create({
    data: {
      name: 'Translation Agent',
      type: AgentType.SELLER,
      description: 'Simulated translation service.',
      walletAddress: '0xDemoTranslate',
      balance: '0.00',
      currency: 'USDC',
      capabilities: stringifyCapabilities(['translation']),
      status: 'active',
    },
  });

  const sink = 'http://127.0.0.1:3000/api/dev/webhook-sink';

  // V2 seller listings (USDC)
  await prisma.listing.create({
    data: {
      providerId: provider.id,
      agentId: weatherA.id,
      capability: 'weather-data',
      unitLabel: '100 requests',
      serviceName: 'Weather Data',
      description: 'Simulated weather data service',
      providerServerDomain: 'https://weather-a.example.com',
      price: '0.10',
      currency: 'USDC',
      payoutAddress: weatherA.walletAddress,
      providerWebhookUrl: sink,
      providerWebhookSecret: generateWebhookSecret(),
      isActive: true,
    },
  });

  await prisma.listing.create({
    data: {
      providerId: provider2.id,
      agentId: weatherB.id,
      capability: 'weather-data',
      unitLabel: '100 requests',
      serviceName: 'Weather Data',
      description: 'Simulated weather data service',
      providerServerDomain: 'https://weather-b.example.com',
      price: '0.15',
      currency: 'USDC',
      payoutAddress: weatherB.walletAddress,
      providerWebhookUrl: sink,
      providerWebhookSecret: generateWebhookSecret(),
      isActive: true,
    },
  });

  await prisma.listing.create({
    data: {
      providerId: provider3.id,
      agentId: weatherC.id,
      capability: 'weather-data',
      unitLabel: '100 requests',
      serviceName: 'Weather Data',
      description: 'Simulated weather data service',
      providerServerDomain: 'https://weather-c.example.com',
      price: '0.20',
      currency: 'USDC',
      payoutAddress: weatherC.walletAddress,
      providerWebhookUrl: sink,
      providerWebhookSecret: generateWebhookSecret(),
      isActive: true,
    },
  });

  await prisma.listing.create({
    data: {
      providerId: provider.id,
      agentId: cryptoAgent.id,
      capability: 'crypto-price',
      unitLabel: '100 requests',
      serviceName: 'Crypto Price Data',
      description: 'Simulated crypto price data',
      providerServerDomain: 'https://crypto.example.com',
      price: '0.05',
      currency: 'USDC',
      payoutAddress: cryptoAgent.walletAddress,
      providerWebhookUrl: sink,
      providerWebhookSecret: generateWebhookSecret(),
      isActive: true,
    },
  });

  await prisma.listing.create({
    data: {
      providerId: provider2.id,
      agentId: translationAgent.id,
      capability: 'translation',
      unitLabel: '1 request',
      serviceName: 'Translation',
      description: 'Simulated translation',
      providerServerDomain: 'https://translate.example.com',
      price: '0.02',
      currency: 'USDC',
      payoutAddress: translationAgent.walletAddress,
      providerWebhookUrl: sink,
      providerWebhookSecret: generateWebhookSecret(),
      isActive: true,
    },
  });

  // Legacy phased-demo listing (USDT) without agent link — keeps architecture walkthrough working
  const legacyListing = await prisma.listing.create({
    data: {
      providerId: provider.id,
      serviceName: 'Weather Agent API (Legacy)',
      description: 'Legacy listing for architecture walkthrough',
      providerServerDomain: 'https://weather-agent.example.com',
      price: '5.00',
      currency: 'USDT',
      payoutAddress: 'TDemoProviderPayoutAddress111',
      providerWebhookUrl: 'https://weather-agent.example.com/webhooks/payment',
      providerWebhookSecret: generateWebhookSecret(),
      isActive: true,
    },
  });

  await prisma.order.create({
    data: {
      listingId: legacyListing.id,
      buyerId: buyer.id,
      buyerDeliveryDomain: 'https://buyer-agent.example.com/inbox',
      amount: legacyListing.price,
      currency: legacyListing.currency,
      paymentReference: generatePaymentReference(),
      status: OrderStatus.pending_payment,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    },
  });

  console.log('Seed complete (V2 agents + legacy walkthrough data).');
  console.log({
    accounts: {
      provider: 'provider@demo.local / Password123!',
      buyer: 'buyer@demo.local / Password123!',
      admin: 'admin@demo.local / Password123!',
    },
    agents: {
      buyer: research.name,
      sellers: [weatherA.name, weatherB.name, weatherC.name, cryptoAgent.name, translationAgent.name],
    },
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
