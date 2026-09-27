import { MandirFlag, REMOTE_CONFIG_FLAG_KEY } from '@mandir/shared-types';
import { PrismaPg } from '@prisma/adapter-pg';

import { runSeed } from '../prisma/seed/index.js';
import { DEV_USERS } from '../src/core/auth/dev-users.js';
import { AppConfigService } from '../src/core/config/config.module.js';
import { StorageService } from '../src/core/storage/storage.service.js';
import { PrismaClient } from '../src/generated/prisma/client.js';

// T3: `pnpm db:seed` is idempotent (docs/modules/01-virtual-mandir.md §14).
// Requires: pnpm dev:infra && pnpm db:migrate. Runs the seed itself (twice).
describe('Mandir seed (e2e)', () => {
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
  });
  const storage = new StorageService(new AppConfigService());
  const devUserId = DEV_USERS['dev-user'].id;

  const snapshot = async () => ({
    deities: await prisma.deity.findMany({ orderBy: { id: 'asc' } }),
    temples: await prisma.temple.count(),
    images: await prisma.deityImage.count({ where: { source: 'OFFICIAL' } }),
    offerings: await prisma.offeringItem.count(),
    offeringDeities: await prisma.offeringItemDeity.count(),
    aartis: await prisma.aarti.count(),
    coinPacks: await prisma.coinPack.count(),
    rewardRules: await prisma.rewardRule.count(),
    flags: await prisma.featureFlag.findMany({ orderBy: { key: 'asc' }, omit: { updatedAt: true } }),
    themes: await prisma.theme.count(),
    wallet: await prisma.coinWallet.findUnique({ where: { userId: devUserId }, omit: { updatedAt: true } }),
    devTxns: await prisma.coinTransaction.count({ where: { userId: devUserId } }),
  });

  afterAll(() => prisma.$disconnect());

  it('running twice changes nothing', { timeout: 120_000 }, async () => {
    await runSeed(prisma, storage);
    const first = await snapshot();
    await runSeed(prisma, storage);
    expect(await snapshot()).toEqual(first);
  });

  it('seeds the §14 T3 content', async () => {
    const deities = await prisma.deity.findMany({
      where: { slug: { in: ['ganesh', 'shiv', 'hanuman', 'vishnu', 'lakshmi', 'durga', 'krishna', 'ram', 'shani', 'surya'] } },
      include: { defaultImage: true, aartis: { where: { isDefault: true } } },
    });
    expect(deities).toHaveLength(10);
    const weekdays = Object.fromEntries(deities.map((d) => [d.slug, d.weekday]));
    expect(weekdays).toMatchObject({ surya: 0, shiv: 1, hanuman: 2, ganesh: 3, vishnu: 4, lakshmi: 5, shani: 6 });
    for (const d of deities) {
      expect(d.defaultImage).toMatchObject({ source: 'OFFICIAL', status: 'PUBLIC' });
      expect(d.defaultImage!.templeId).not.toBeNull();
      expect(d.aartis).toHaveLength(1);
    }

    const specials = await prisma.offeringItem.findMany({
      where: { kind: 'SPECIAL' },
      include: { deities: { include: { deity: true } } },
    });
    expect(Object.fromEntries(specials.map((s) => [s.nameEn, s.deities.map((x) => x.deity.slug)]))).toMatchObject({
      Sindoor: ['hanuman'],
      'Jal abhishek': ['shiv'],
      'Mustard oil': ['shani'],
    });
    for (const kind of ['FLOWER', 'MALA', 'DIYA', 'BHOG'] as const) {
      const items = await prisma.offeringItem.findMany({ where: { kind } });
      expect(items.some((i) => i.coinCost === 0)).toBe(true);
      expect(items.some((i) => i.coinCost > 0)).toBe(true);
    }
    for (const item of await prisma.offeringItem.findMany()) {
      expect(item.particleCount).toBeLessThanOrEqual(30);
    }

    expect(await prisma.coinPack.count({ where: { isActive: true } })).toBeGreaterThanOrEqual(4);
    expect(await prisma.rewardRule.findUnique({ where: { key: 'FIRST_DARSHAN_OF_DAY' } })).toMatchObject({
      coins: 1,
      dailyCap: 1,
    });
    expect(await prisma.theme.findUnique({ where: { key: 'default' } })).toMatchObject({ isActive: true });

    const flags = await prisma.featureFlag.findMany({ where: { key: { in: Object.values(MandirFlag) } } });
    expect(flags).toHaveLength(Object.values(MandirFlag).length);
    const remote = await prisma.featureFlag.findUnique({ where: { key: REMOTE_CONFIG_FLAG_KEY } });
    expect(remote!.payload).toMatchObject({ freeOfferingsPerDeityPerDay: expect.any(Number) });

    const wallet = await prisma.coinWallet.findUnique({ where: { userId: devUserId } });
    const ledger = await prisma.coinTransaction.aggregate({ where: { userId: devUserId }, _sum: { amount: true } });
    expect(wallet!.balance).toBe(ledger._sum.amount);
  });

  it('placeholder media is served from the public bucket', async () => {
    const image = await prisma.deityImage.findFirstOrThrow({ where: { source: 'OFFICIAL' } });
    const aarti = await prisma.aarti.findFirstOrThrow();
    const offering = await prisma.offeringItem.findFirstOrThrow();
    const theme = await prisma.theme.findUniqueOrThrow({ where: { key: 'default' } });
    const keys = [
      image.objectKey,
      ...Object.values(image.variants as Record<string, string>),
      aarti.audioKey,
      aarti.lyricsKey,
      offering.iconUrl,
      offering.spriteUrl,
      theme.frameKey,
    ];
    for (const key of keys) {
      const res = await fetch(storage.publicUrl(key), { method: 'HEAD' });
      expect(res.status, key).toBe(200);
    }
  });
});
