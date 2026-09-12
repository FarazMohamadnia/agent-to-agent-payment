import { prisma } from '../db/prisma';
import { AppError } from '../utils/errors';
import { decimalStr, parseCapabilities } from '../utils/agentHelpers';
import { DiscoverableOffer } from './decisionEngine';

function toPublicAgent(agent: {
  id: string;
  name: string;
  type: string;
  description: string;
  walletAddress: string;
  balance: { toString(): string };
  currency: string;
  capabilities: string;
  status: string;
  maxTransaction: { toString(): string } | null;
  dailyLimit: { toString(): string } | null;
  dailySpent: { toString(): string };
  allowedToken: string;
}) {
  return {
    id: agent.id,
    name: agent.name,
    type: agent.type,
    description: agent.description,
    walletAddress: agent.walletAddress,
    balance: decimalStr(agent.balance),
    currency: agent.currency,
    capabilities: parseCapabilities(agent.capabilities),
    status: agent.status,
    spendingPolicy:
      agent.type === 'BUYER'
        ? {
            maxTransaction:
              agent.maxTransaction != null ? decimalStr(agent.maxTransaction) : null,
            dailyLimit: agent.dailyLimit != null ? decimalStr(agent.dailyLimit) : null,
            dailySpent: decimalStr(agent.dailySpent),
            allowedToken: agent.allowedToken,
          }
        : undefined,
  };
}

export async function listAgents(capability?: string) {
  const agents = await prisma.agent.findMany({
    where: { status: 'active' },
    orderBy: { name: 'asc' },
  });
  let result = agents.map(toPublicAgent);
  if (capability) {
    result = result.filter((a) => a.capabilities.includes(capability));
  }
  return result;
}

export async function getAgent(id: string) {
  const agent = await prisma.agent.findUnique({ where: { id } });
  if (!agent) throw new AppError(404, 'AGENT_NOT_FOUND', 'Agent not found');
  return toPublicAgent(agent);
}

export async function discoverOffers(capability?: string): Promise<DiscoverableOffer[]> {
  const listings = await prisma.listing.findMany({
    where: {
      isActive: true,
      agentId: { not: null },
      ...(capability ? { capability } : {}),
    },
    include: { agent: true },
    orderBy: { price: 'asc' },
  });

  return listings
    .filter((l) => l.agent && l.agent.status === 'active' && l.agent.type === 'SELLER')
    .map((l) => ({
      agentId: l.agent!.id,
      agentName: l.agent!.name,
      capability: l.capability || 'general',
      serviceName: l.serviceName,
      listingId: l.id,
      price: decimalStr(l.price),
      currency: l.currency,
      unitLabel: l.unitLabel,
      description: l.description,
    }));
}
