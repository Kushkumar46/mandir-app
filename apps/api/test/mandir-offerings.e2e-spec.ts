import 'reflect-metadata';
import { randomUUID } from 'node:crypto';

import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { type DeityOfferings, MandirFlag, type MakeOfferingResponse } from '@mandir/shared-types';
import request from 'supertest';

import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/app.setup.js';
import { FeatureFlagService } from '../src/core/feature-flags/feature-flag.service.js';
import { PrismaService } from '../src/core/prisma/prisma.module.js';
import { addDays, localDateIn } from '../src/core/time/local-date.js';
import type { Deity, OfferingItem } from '../src/generated/prisma/client.js';
import { CoinsService } from '../src/modules/coins/coins.service.js';

const TZ = 'Asia/Kolkata';

// T6: offerings API — free (unlimited), paid, insufficient, reward granted once (§6.3–§6.5).
// The per-user throttle is covered by mandir-offerings-throttle.e2e-spec.ts.
// Requires: pnpm dev:infra && pnpm db:migrate && pnpm db:seed, and DEV_AUTH=true in .env
describe('Mandir offerings (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let flags: FeatureFlagService;
  let coins: CoinsService;
  const deities = new Map<string, Deity>();
  const items = new Map<string, OfferingItem>();
  const createdUsers: string[] = [];
  const createdDeities: string[] = [];

  const api = () => request(app.getHttpServer());
  const deity = (slug: string) => deities.get(slug)!;
  const item = (nameEn: string) => items.get(nameEn)!;
  const as = (userId: string) => ({
    offerings: (deityId: string) => api().get(`/v1/deities/${deityId}/offerings`).set('X-Dev-User', userId),
    offer: (deityId: string, offeringItemId: string, key: string = randomUUID()) =>
      api()
        .post('/v1/mandir/offerings')
        .set('X-Dev-User', userId)
        .set('Idempotency-Key', key)
        .send({ deityId, offeringItemId }),
  });

  async function newUser(startCoins = 0): Promise<string> {
    const user = await prisma.user.create({ data: { name: `T6 ${randomUUID().slice(0, 8)}`, timezone: TZ } });
    createdUsers.push(user.id);
    if (startCoins > 0) await coins.credit(user.id, startCoins, { reason: 'ADMIN_ADJUST', refType: 'admin', refId: 'test' });
    return user.id;
  }

  const rewardRows = (userId: string) =>
    prisma.coinTransaction.findMany({ where: { userId, reason: 'REWARD', refId: 'FIRST_DARSHAN_OF_DAY' } });
  const offeringLogs = (userId: string) => prisma.ritualLog.findMany({ where: { userId, action: 'OFFERING' } });

  async function withFlag(key: string, enabled: boolean, fn: () => Promise<void>) {
    const before = await prisma.featureFlag.findUniqueOrThrow({ where: { key } });
    await prisma.featureFlag.update({ where: { key }, data: { enabled, rolloutPercent: 100 } });
    flags.invalidate();
    try {
      await fn();
    } finally {
      await prisma.featureFlag.update({
        where: { key },
        data: { enabled: before.enabled, rolloutPercent: before.rolloutPercent },
      });
      flags.invalidate();
    }
  }

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);
    flags = app.get(FeatureFlagService);
    coins = app.get(CoinsService);
    for (const d of await prisma.deity.findMany()) deities.set(d.slug, d);
    for (const i of await prisma.offeringItem.findMany()) items.set(i.nameEn, i);
  });

  afterAll(async () => {
    if (prisma) {
      await prisma.coinTransaction.deleteMany({ where: { userId: { in: createdUsers } } });
      await prisma.ritualLog.deleteMany({ where: { userId: { in: createdUsers } } });
      await prisma.user.deleteMany({ where: { id: { in: createdUsers } } });
      await prisma.deity.deleteMany({ where: { id: { in: createdDeities } } });
    }
    await app?.close();
  });

  describe('GET /v1/deities/:deityId/offerings', () => {
    it('groups valid items by kind; deity-specific items only for their deity', async () => {
      const userId = await newUser();
      const res = await as(userId).offerings(deity('hanuman').id).expect(200);
      const body = res.body.data as DeityOfferings;

      expect(body.deityId).toBe(deity('hanuman').id);
      expect(body.groups.map((g) => g.kind)).toEqual(['FLOWER', 'MALA', 'DIYA', 'BHOG', 'SPECIAL']);
      // Every kind has a free basic item and a premium one (§12 seed).
      for (const group of body.groups) {
        expect(group.items.some((i) => i.coinCost === 0), group.kind).toBe(true);
        expect(group.items.some((i) => i.coinCost > 0), group.kind).toBe(true);
      }
      const specialsOf = (b: DeityOfferings) =>
        b.groups
          .find((g) => g.kind === 'SPECIAL')!
          .items.map((i) => i.nameEn)
          .sort();
      expect(specialsOf(body)).toEqual(['Chandan', 'Sindoor']);
      const flowers = body.groups.find((g) => g.kind === 'FLOWER')!.items;
      expect(flowers[0]).toMatchObject({
        iconUrl: expect.stringMatching(/^http/),
        spriteUrl: expect.stringMatching(/^http/),
        animationKey: 'falling_flowers',
      });
      expect(body).not.toHaveProperty('limits');

      const shiv = (await as(userId).offerings(deity('shiv').id).expect(200)).body.data as DeityOfferings;
      expect(specialsOf(shiv)).toEqual(['Chandan', 'Jal abhishek']);
      const durga = (await as(userId).offerings(deity('durga').id).expect(200)).body.data as DeityOfferings;
      expect(specialsOf(durga)).toEqual(['Chandan', 'Chunari']);
      const ganesh = (await as(userId).offerings(deity('ganesh').id).expect(200)).body.data as DeityOfferings;
      expect(specialsOf(ganesh)).toEqual(['Chandan']);
    });

    it('hides paid items while mandir.premium_offerings is off', async () => {
      const userId = await newUser();
      await withFlag(MandirFlag.PREMIUM_OFFERINGS, false, async () => {
        const body = (await as(userId).offerings(deity('hanuman').id).expect(200)).body.data as DeityOfferings;
        expect(body.groups.flatMap((g) => g.items).every((i) => i.coinCost === 0)).toBe(true);
      });
    });

    it('unknown / inactive deity → 404 DEITY_NOT_AVAILABLE; bad id → 400', async () => {
      const userId = await newUser();
      const inactive = await prisma.deity.create({
        data: { slug: `t6-inactive-${randomUUID().slice(0, 8)}`, nameHi: 'x', nameEn: 'x', isActive: false },
      });
      createdDeities.push(inactive.id);
      for (const id of [randomUUID(), inactive.id]) {
        expect((await as(userId).offerings(id).expect(404)).body.error.code).toBe('DEITY_NOT_AVAILABLE');
      }
      await as(userId).offerings('nope').expect(400);
    });
  });

  describe('POST /v1/mandir/offerings', () => {
    it('free offering: no coins spent, darshan day counted, first-of-day reward paid', async () => {
      const userId = await newUser();
      const res = await as(userId).offer(deity('hanuman').id, item('Marigold').id).expect(200);

      expect(res.body.data as MakeOfferingResponse).toEqual({
        coinsBalance: 1,
        coinsSpent: 0,
        streak: { current: 1, doneToday: true },
        reward: { ruleKey: 'FIRST_DARSHAN_OF_DAY', coins: 1 },
        todayOfferings: { flowers: 1, mala: false, diya: false, bhog: false },
      });
      const logs = await offeringLogs(userId);
      expect(logs).toHaveLength(1);
      expect(logs[0]).toMatchObject({
        deityId: deity('hanuman').id,
        offeringItemId: item('Marigold').id,
        coinsSpent: 0,
        localDate: localDateIn(TZ),
      });
      expect(await coins.getBalance(userId)).toBe(1);

      // Deity-specific item for its deity, and the home screen reflects the offering.
      await as(userId).offer(deity('hanuman').id, item('Sindoor').id).expect(200);
      const home = await api().get('/v1/mandir/home').set('X-Dev-User', userId).expect(200);
      expect(home.body.data.todayOfferings[deity('hanuman').id]).toEqual({ flowers: 1, mala: false, diya: false, bhog: false });
      expect(home.body.data.streak).toEqual({ current: 1, longest: 1, doneToday: true });
    });

    it('paid offering: coins debited against the offering log, balance returned', async () => {
      const userId = await newUser(20);
      const rose = item('Rose');
      const res = await as(userId).offer(deity('ganesh').id, rose.id).expect(200);
      const body = res.body.data as MakeOfferingResponse;

      expect(body).toMatchObject({ coinsSpent: rose.coinCost, reward: { ruleKey: 'FIRST_DARSHAN_OF_DAY', coins: 1 } });
      expect(body.coinsBalance).toBe(20 - rose.coinCost + 1);
      expect(await coins.getBalance(userId)).toBe(body.coinsBalance);

      const [log] = await offeringLogs(userId);
      expect(log).toMatchObject({ coinsSpent: rose.coinCost });
      const debit = await prisma.coinTransaction.findFirstOrThrow({ where: { userId, amount: { lt: 0 } } });
      expect(debit).toMatchObject({ amount: -rose.coinCost, reason: 'OFFERING', refType: 'offering', refId: log!.id });

      // Paid items are not limited by the free quota.
      const res2 = await as(userId).offer(deity('ganesh').id, item('Pancha-deep').id).expect(200);
      expect(res2.body.data).toMatchObject({ reward: null, todayOfferings: { flowers: 1, diya: true } });
    });

    it('insufficient coins → 402 with { required, balance }; nothing is written; same key works after top-up', async () => {
      const userId = await newUser(2);
      const laddoo = item('Chhappan bhog');
      const key = randomUUID();

      const res = await as(userId).offer(deity('ganesh').id, laddoo.id, key).expect(402);
      expect(res.body.error).toMatchObject({
        code: 'COINS_INSUFFICIENT',
        details: { required: laddoo.coinCost, balance: 2 },
      });
      expect(await offeringLogs(userId)).toHaveLength(0);
      expect(await rewardRows(userId)).toHaveLength(0);
      expect(await prisma.userStreak.findUnique({ where: { userId } })).toBeNull();
      expect(await coins.getBalance(userId)).toBe(2);

      await coins.credit(userId, laddoo.coinCost, { reason: 'PURCHASE', refType: 'purchase', refId: 'test' });
      const ok = await as(userId).offer(deity('ganesh').id, laddoo.id, key).expect(200);
      expect(ok.body.data).toMatchObject({ coinsSpent: laddoo.coinCost, coinsBalance: 3, todayOfferings: { bhog: true } });
    });

    it('free offerings are unlimited (§6.5) and earn no extra rewards', async () => {
      const userId = await newUser();
      const free = ['Marigold', 'Clay diya', 'Mishri bhog', 'Marigold garland', 'Jal abhishek'];
      const responses = [];
      for (let i = 0; i < 12; i++) {
        responses.push(await as(userId).offer(deity('shiv').id, item(free[i % free.length]!).id).expect(200));
      }
      const last = responses.at(-1)!.body.data as MakeOfferingResponse;
      expect(last).toMatchObject({ coinsSpent: 0, coinsBalance: 1, reward: null });
      expect(last.todayOfferings).toEqual({ flowers: 3, mala: true, diya: true, bhog: true });
      expect(responses.filter((r) => r.body.data.reward !== null)).toHaveLength(1);
      expect(await offeringLogs(userId)).toHaveLength(12);
      expect(await rewardRows(userId)).toHaveLength(1);

      // Concurrent free offerings all land too.
      const burst = await Promise.all(Array.from({ length: 8 }, () => as(userId).offer(deity('vishnu').id, item('Marigold').id)));
      expect(burst.every((r) => r.status === 200)).toBe(true);
      expect(await offeringLogs(userId)).toHaveLength(20);
    });

    it('FIRST_DARSHAN_OF_DAY is granted once per day, also under concurrency', async () => {
      const userId = await newUser();
      const first = await as(userId).offer(deity('ram').id, item('Marigold').id).expect(200);
      const second = await as(userId).offer(deity('ram').id, item('Clay diya').id).expect(200);
      expect(first.body.data.reward).toEqual({ ruleKey: 'FIRST_DARSHAN_OF_DAY', coins: 1 });
      expect(second.body.data.reward).toBeNull();
      expect(second.body.data.coinsBalance).toBe(1);
      expect(await rewardRows(userId)).toHaveLength(1);

      const racer = await newUser();
      const slugs = ['ganesh', 'shiv', 'ram', 'krishna', 'durga'];
      const responses = await Promise.all(slugs.map((s) => as(racer).offer(deity(s).id, item('Marigold').id)));
      expect(responses.every((r) => r.status === 200)).toBe(true);
      expect(responses.filter((r) => r.body.data.reward !== null)).toHaveLength(1);
      expect(await rewardRows(racer)).toHaveLength(1);
      expect(await coins.getBalance(racer)).toBe(1);
    });

    it('no reward while mandir.rewards is off', async () => {
      const userId = await newUser();
      await withFlag(MandirFlag.REWARDS, false, async () => {
        const res = await as(userId).offer(deity('ganesh').id, item('Marigold').id).expect(200);
        expect(res.body.data).toMatchObject({ reward: null, coinsBalance: 0, streak: { current: 1, doneToday: true } });
      });
      expect(await rewardRows(userId)).toHaveLength(0);
    });

    it('streak: continues from yesterday, restarts after a gap (§6.3)', async () => {
      const today = localDateIn(TZ);
      const continuing = await newUser();
      await prisma.userStreak.create({
        data: { userId: continuing, current: 4, longest: 9, lastDate: addDays(today, -1) },
      });
      const res = await as(continuing).offer(deity('ganesh').id, item('Marigold').id).expect(200);
      expect(res.body.data.streak).toEqual({ current: 5, doneToday: true });
      await as(continuing).offer(deity('ganesh').id, item('Marigold').id).expect(200);
      expect(await prisma.userStreak.findUnique({ where: { userId: continuing } })).toMatchObject({
        current: 5,
        longest: 9,
        lastDate: today,
      });

      const broken = await newUser();
      await prisma.userStreak.create({ data: { userId: broken, current: 4, longest: 4, lastDate: addDays(today, -2) } });
      const res2 = await as(broken).offer(deity('ganesh').id, item('Marigold').id).expect(200);
      expect(res2.body.data.streak).toEqual({ current: 1, doneToday: true });
      expect(await prisma.userStreak.findUnique({ where: { userId: broken } })).toMatchObject({ current: 1, longest: 4 });
    });

    it('item not valid for the deity, inactive or unknown → 404 ITEM_NOT_AVAILABLE', async () => {
      const userId = await newUser(50);
      for (const itemId of [item('Sindoor').id, randomUUID()]) {
        const res = await as(userId).offer(deity('shiv').id, itemId).expect(404);
        expect(res.body.error.code).toBe('ITEM_NOT_AVAILABLE');
      }
      const inactive = await prisma.offeringItem.findFirstOrThrow({ where: { nameEn: 'Lotus' } });
      await prisma.offeringItem.update({ where: { id: inactive.id }, data: { isActive: false } });
      try {
        expect((await as(userId).offer(deity('shiv').id, inactive.id).expect(404)).body.error.code).toBe('ITEM_NOT_AVAILABLE');
      } finally {
        await prisma.offeringItem.update({ where: { id: inactive.id }, data: { isActive: true } });
      }
      const res = await as(userId).offer(randomUUID(), item('Marigold').id).expect(404);
      expect(res.body.error.code).toBe('DEITY_NOT_AVAILABLE');
      expect(await offeringLogs(userId)).toHaveLength(0);
    });

    it('paid item while mandir.premium_offerings is off → 403 FEATURE_DISABLED; free still works', async () => {
      const userId = await newUser(50);
      await withFlag(MandirFlag.PREMIUM_OFFERINGS, false, async () => {
        const res = await as(userId).offer(deity('ganesh').id, item('Rose').id).expect(403);
        expect(res.body.error).toMatchObject({ code: 'FEATURE_DISABLED', details: { flag: MandirFlag.PREMIUM_OFFERINGS } });
        await as(userId).offer(deity('ganesh').id, item('Marigold').id).expect(200);
      });
      expect(await coins.getBalance(userId)).toBe(51);
    });

    it('whole route is off with mandir.offerings', async () => {
      const userId = await newUser();
      await withFlag(MandirFlag.OFFERINGS, false, async () => {
        await as(userId).offer(deity('ganesh').id, item('Marigold').id).expect(403);
        await as(userId).offerings(deity('ganesh').id).expect(403);
      });
    });

    it('a repeated Idempotency-Key replays the response and spends once', async () => {
      const userId = await newUser(20);
      const key = randomUUID();
      const first = await as(userId).offer(deity('ganesh').id, item('Rose').id, key).expect(200);
      const again = await as(userId).offer(deity('ganesh').id, item('Rose').id, key).expect(200);
      expect(again.body).toEqual(first.body);
      expect(again.headers['idempotent-replayed']).toBe('true');
      expect(await offeringLogs(userId)).toHaveLength(1);
      expect(await coins.getBalance(userId)).toBe(20 - item('Rose').coinCost + 1);
    });

    it('validates the request: Idempotency-Key required, uuids in body', async () => {
      const userId = await newUser();
      const noKey = await api()
        .post('/v1/mandir/offerings')
        .set('X-Dev-User', userId)
        .send({ deityId: deity('ganesh').id, offeringItemId: item('Marigold').id })
        .expect(400);
      expect(noKey.body.error.code).toBe('IDEMPOTENCY_KEY_REQUIRED');
      const bad = await as(userId).offer('nope', item('Marigold').id).expect(400);
      expect(bad.body.error.code).toBe('VALIDATION_FAILED');
    });
  });
});
