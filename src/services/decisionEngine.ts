import { AppError } from '../utils/errors';
import { decimalStr } from '../utils/agentHelpers';

export interface DiscoverableOffer {
  agentId: string;
  agentName: string;
  capability: string;
  serviceName: string;
  listingId: string;
  price: string;
  currency: string;
  unitLabel: string | null;
  description: string;
}

export class AgentDecisionEngine {
  /**
   * Deterministic: pick the cheapest offer matching capability (+ optional currency).
   */
  selectCheapest(
    offers: DiscoverableOffer[],
    capability: string,
    currency = 'USDC',
  ): DiscoverableOffer {
    const matched = offers.filter(
      (o) =>
        o.capability === capability &&
        o.currency === currency &&
        Number(o.price) >= 0,
    );
    if (matched.length === 0) {
      throw new AppError(
        404,
        'NO_PROVIDER',
        `No available providers for capability "${capability}" in ${currency}`,
      );
    }
    matched.sort((a, b) => Number(a.price) - Number(b.price));
    return matched[0];
  }

  comparePrices(offers: DiscoverableOffer[]): DiscoverableOffer[] {
    return [...offers].sort((a, b) => Number(a.price) - Number(b.price));
  }

  summarizeSelection(selected: DiscoverableOffer, considered: DiscoverableOffer[]) {
    return {
      selected: {
        agentName: selected.agentName,
        listingId: selected.listingId,
        price: decimalStr(selected.price),
        currency: selected.currency,
      },
      considered: considered.map((o) => ({
        agentName: o.agentName,
        price: decimalStr(o.price),
        currency: o.currency,
      })),
      rule: 'cheapest_valid_provider',
    };
  }
}

export const agentDecisionEngine = new AgentDecisionEngine();
