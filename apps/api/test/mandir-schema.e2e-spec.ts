import { randomUUID } from 'node:crypto';

import { PrismaPg } from '@prisma/adapter-pg';

import { PrismaClient } from '../src/generated/prisma/client.js';

// T2: DB-level guarantees of the mandir/coins schema (docs/modules/01-virtual-mandir.md §5).
// Requires: pnpm dev:infra && pnpm db:migrate. Creates and removes its own rows.
describe('Mandir schema (e2e)', () => {
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
  });
  const userId = randomUUID();
  const deityId = randomUUID();

  beforeAll(async () => {
    await prisma.user.create({ data: { id: userId, name: 'schema-test' } });
    await prisma.deity.create({
      data: { id: deityId, slug: `schema-test-${deityId}`, nameHi: 'परीक्षण', nameEn: 'Test' },
    });
  });

  afterAll(async () => {
    await prisma.coinTransaction.deleteMany({ where: { userId } });
    await prisma.user.deleteMany({ where: { id: userId } });
    await prisma.deity.updateMany({ where: { id: deityId }, data: { defaultImageId: null } });
    await prisma.deityImage.deleteMany({ where: { deityId } });
    await prisma.deity.deleteMany({ where: { id: deityId } });
    await prisma.$disconnect();
  });

  it('coin wallet balance can never go below 0', async () => {
    await prisma.coinWallet.create({ data: { userId, balance: 5 } });
    await expect(
      prisma.coinWallet.update({ where: { userId }, data: { balance: { decrement: 6 } } }),
    ).rejects.toThrow();
    const wallet = await prisma.coinWallet.findUniqueOrThrow({ where: { userId } });
    expect(wallet.balance).toBe(5);
  });

  it('coin transactions reject zero amounts and negative balanceAfter', async () => {
    await expect(
      prisma.coinTransaction.create({
        data: { userId, amount: 0, balanceAfter: 5, reason: 'ADMIN_ADJUST' },
      }),
    ).rejects.toThrow();
    await expect(
      prisma.coinTransaction.create({
        data: { userId, amount: -10, balanceAfter: -5, reason: 'OFFERING' },
      }),
    ).rejects.toThrow();
  });

  it('removing a selected image falls the user back to default (selectedImageId → null)', async () => {
    const image = await prisma.deityImage.create({
      data: { deityId, source: 'OFFICIAL', status: 'PUBLIC', objectKey: 'test/schema.jpg' },
    });
    await prisma.deity.update({ where: { id: deityId }, data: { defaultImageId: image.id } });
    await prisma.userDeity.create({
      data: { userId, deityId, position: 0, selectedImageId: image.id },
    });

    await prisma.deityImage.delete({ where: { id: image.id } });

    const ud = await prisma.userDeity.findUniqueOrThrow({
      where: { userId_deityId: { userId, deityId } },
    });
    expect(ud.selectedImageId).toBeNull();
    const deity = await prisma.deity.findUniqueOrThrow({ where: { id: deityId } });
    expect(deity.defaultImageId).toBeNull();
  });

  it('deleting a user cascades user-owned rows but keeps coin transactions', async () => {
    await prisma.userStreak.create({ data: { userId, current: 1, longest: 1 } });
    await prisma.coinTransaction.create({
      data: { userId, amount: 5, balanceAfter: 5, reason: 'REWARD' },
    });

    await prisma.user.delete({ where: { id: userId } });

    expect(await prisma.coinWallet.count({ where: { userId } })).toBe(0);
    expect(await prisma.userStreak.count({ where: { userId } })).toBe(0);
    expect(await prisma.userDeity.count({ where: { userId } })).toBe(0);
    expect(await prisma.coinTransaction.count({ where: { userId } })).toBe(1);
  });
});
