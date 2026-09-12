import { Role } from '@prisma/client';
import { registerUser } from '../../src/services/authService';
import * as listingService from '../../src/services/listingService';
import { resetDatabase } from '../helpers';
import { AppError } from '../../src/utils/errors';

const baseListing = {
  serviceName: 'Test Service',
  description: 'A test listing',
  providerServerDomain: 'https://provider.example.com',
  price: '9.99',
  currency: 'USDT',
  payoutAddress: 'addr-1',
  providerWebhookUrl: 'https://provider.example.com/hook',
};

describe('Listing service', () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it('creates a listing with a webhook secret', async () => {
    const provider = await registerUser('p@ex.com', 'Password123!', Role.PROVIDER);
    const listing = await listingService.createListing(provider.user.id, baseListing);
    expect(listing.serviceName).toBe('Test Service');
    expect(listing.providerWebhookSecret).toHaveLength(64);
  });

  it('prevents another provider from updating a listing', async () => {
    const p1 = await registerUser('p1@ex.com', 'Password123!', Role.PROVIDER);
    const p2 = await registerUser('p2@ex.com', 'Password123!', Role.PROVIDER);
    const listing = await listingService.createListing(p1.user.id, baseListing);
    await expect(
      listingService.updateListing(p2.user.id, listing.id, { serviceName: 'Hacked' }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' } as Partial<AppError>);
  });

  it('deactivates own listing', async () => {
    const p1 = await registerUser('p1@ex.com', 'Password123!', Role.PROVIDER);
    const listing = await listingService.createListing(p1.user.id, baseListing);
    const deactivated = await listingService.deactivateListing(p1.user.id, listing.id);
    expect(deactivated.isActive).toBe(false);
  });

  it('public catalog hides payout and webhook secret', async () => {
    const p1 = await registerUser('p1@ex.com', 'Password123!', Role.PROVIDER);
    await listingService.createListing(p1.user.id, baseListing);
    const publicList = await listingService.listPublicActive();
    expect(publicList).toHaveLength(1);
    expect(publicList[0]).not.toHaveProperty('payoutAddress');
    expect(publicList[0]).not.toHaveProperty('providerWebhookSecret');
  });
});
