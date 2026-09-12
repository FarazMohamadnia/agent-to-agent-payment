import { prisma } from '../src/db/prisma';
import { resetPaymentVerifier } from '../src/payments';

export async function resetDatabase(): Promise<void> {
  await prisma.webhookDeliveryLog.deleteMany();
  await prisma.order.deleteMany();
  await prisma.listing.deleteMany();
  await prisma.user.deleteMany();
  resetPaymentVerifier();
}

afterAll(async () => {
  await prisma.$disconnect();
});
