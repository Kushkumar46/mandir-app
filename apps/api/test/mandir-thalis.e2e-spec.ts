import 'reflect-metadata';
import { randomUUID } from 'node:crypto';

import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { MandirFlag, type ThaliList, type UnlockThaliResponse } from '@mandir/shared-types';
import request from 'supertest';

import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/app.setup.js';
import { FeatureFlagService } from '../src/core/feature-flags/feature-flag.service.js';
import { PrismaService } from '../src/core/prisma/prisma.module.js';
import type { Aarti, Deity, FeatureFlag, ThaliDesign } from '../src/generated/prisma/client.js';
import { CoinsService } from '../src/modules/coins/coins.service.js';

// T7b: thali designs and permanent unlocks (§6.8, §7 "Thali contract").
// Requires: pnpm dev:infra && pnpm db:migrate && pnpm db:seed, and DEV_AUTH=true in .env
describe('Mandir thalis (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let flags: FeatureFlagService;
  let coins: CoinsService;
  let flagBefore: FeatureFlag;
  let shiv: Deity;
  let shivAarti: Aarti;
  const thalis = new Map<string, ThaliDesign>();
  const createdUsers: string[] = [];

  const api = () => request(app.getHttpServer());
  const thali = (nameEn: string) => thalis.get(nameEn)!;
  const as = (userId: string) => ({
    list: () => api().get('/v1/mandir/thalis').set('X-Dev-User', userId),
    unlock: (thaliId: string, key: string | null = randomUUID()) => {
      const req = api().post(`/v1/mandir/thalis/${thaliId}/unlock`).set('X-Dev-User', userId);
      return key ? req.set('Idempotency-Key', key) : req;
    },
    select: (thaliId: string) => api().put('/v1/mandir/thali').set('X-Dev-User', userId).send({ thaliId }),
    home: () => api().get('/v1/mandir/home').set('X-Dev-User', userId),
    aarti: (thaliId?: string) =>
      api()
        .post('/v1/mandir/rituals/aarti-complete')
        .set('X-Dev-User', userId)
        .set('Idempotency-Key', randomUUID())
        .send({ deityId: shiv.id, aartiId: shivAarti.id, playedRatio: 1, circles: 3, ...(thaliId && { thaliId }) }),
  });

  async function newUser(startCoins = 0): Promise<string> {
    const user = await prisma.user.create({ data: { name: `T7b ${randomUUID().slice(0, 8)}` } });
    createdUsers.push(user.id);
    if (startCoins > 0) await coins.credit(user.id, startCoins, { reason: 'ADMIN_ADJUST', refType: 'admin', refId: 'test' });
    return user.id;
  }

  const unlockDebits = (userId: string) => prisma.coinTransaction.findMany({ where: { userId, reason: 'UNLOCK' } });
  const unlockRows = (userId: string) => prisma.userUnlock.findMany({ where: { userId } });

  async function setThaliFlag(enabled: boolean) {
    await prisma.featureFlag.update({ where: { key: MandirFlag.THALI_DESIGNS }, data: { enabled, rolloutPercent: 100 } });
    flags.invalidate();
  }

  async function withInactive(t: ThaliDesign, fn: () => Promise<void>) {
    await prisma.thaliDesign.update({ where: { id: t.id }, data: { isActive: false } });
    try {
      await fn();
    } finally {
      await prisma.thaliDesign.update({ where: { id: t.id }, data: { isActive: true } });
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
    for (const t of await prisma.thaliDesign.findMany()) thalis.set(t.nameEn, t);
    shiv = await prisma.deity.findUniqueOrThrow({ where: { slug: 'shiv' } });
    shivAarti = await prisma.aarti.findFirstOrThrow({ where: { deityId: shiv.id, isDefault: true } });
    flagBefore = await prisma.featureFlag.findUniqueOrThrow({ where: { key: MandirFlag.THALI_DESIGNS } });
    await setThaliFlag(true);
  });

  afterAll(async () => {
    if (prisma) {
      if (flagBefore) {
        await prisma.featureFlag.update({
          where: { key: MandirFlag.THALI_DESIGNS },
          data: { enabled: flagBefore.enabled, rolloutPercent: flagBefore.rolloutPercent },
        });
      }
      await prisma.coinTransaction.deleteMany({ where: { userId: { in: createdUsers } } });
      await prisma.ritualLog.deleteMany({ where: { userId: { in: createdUsers } } });
      await prisma.user.deleteMany({ where: { id: { in: createdUsers } } });
    }
    await app?.close();
  });

  it('seed: 1 free default + 3 premium designs; the flag is seeded off', () => {
    expect([...thalis.values()].filter((t) => t.coinCost === 0).map((t) => t.nameEn)).toEqual(['Brass thali']);
    expect(thali('Pancha-deep thali')).toMatchObject({ coinCost: 151, flameStyle: 'pancha' });
    expect([thali('Silver thali').coinCost, thali('Gold thali').coinCost]).toEqual([51, 108]);
    expect(flagBefore.enabled).toBe(false);
  });

  describe('GET /v1/mandir/thalis', () => {
    it('active designs by sortOrder; free ones unlocked; default free thali selected', async () => {
      const userId = await newUser();
      const body = (await as(userId).list().expect(200)).body.data as ThaliList;

      expect(body.selectedThaliId).toBe(thali('Brass thali').id);
      expect(body.items.map((t) => [t.nameEn, t.unlocked, t.selected])).toEqual([
        ['Brass thali', true, true],
        ['Silver thali', false, false],
        ['Gold thali', false, false],
        ['Pancha-deep thali', false, false],
      ]);
      expect(body.items[1]).toEqual({
        id: thali('Silver thali').id,
        nameHi: 'चाँदी की थाली',
        nameEn: 'Silver thali',
        imageUrl: expect.stringMatching(/^http.*official\/thalis\/chaandi\/image\.webp$/),
        flameStyle: 'single',
        coinCost: 51,
        unlocked: false,
        selected: false,
      });
    });
  });

  describe('POST /v1/mandir/thalis/:thaliId/unlock', () => {
    it('debits coinCost once against the unlock row; does not auto-select', async () => {
      const userId = await newUser(200);
      const silver = thali('Silver thali');
      const res = await as(userId).unlock(silver.id).expect(200);
      expect(res.body.data as UnlockThaliResponse).toEqual({ thaliId: silver.id, coinsSpent: 51, coinsBalance: 149 });

      const [unlock, ...more] = await unlockRows(userId);
      expect(more).toHaveLength(0);
      expect(unlock).toMatchObject({ itemType: 'THALI', itemId: silver.id, coinsSpent: 51 });
      const [debit, ...moreDebits] = await unlockDebits(userId);
      expect(moreDebits).toHaveLength(0);
      expect(debit).toMatchObject({ amount: -51, balanceAfter: 149, refType: 'unlock', refId: unlock!.id });

      const list = (await as(userId).list().expect(200)).body.data as ThaliList;
      expect(list.items.find((t) => t.id === silver.id)).toMatchObject({ unlocked: true, selected: false });
      expect(list.selectedThaliId).toBe(thali('Brass thali').id);
    });

    it('already unlocked (new key) or free → 409 ALREADY_UNLOCKED, no debit', async () => {
      const userId = await newUser(200);
      const silver = thali('Silver thali');
      await as(userId).unlock(silver.id).expect(200);

      const dup = await as(userId).unlock(silver.id).expect(409);
      expect(dup.body.error).toMatchObject({ code: 'ALREADY_UNLOCKED', details: { thaliId: silver.id } });
      expect((await as(userId).unlock(thali('Brass thali').id).expect(409)).body.error.code).toBe('ALREADY_UNLOCKED');

      expect(await unlockDebits(userId)).toHaveLength(1);
      expect(await coins.getBalance(userId)).toBe(149);
    });

    it('repeated Idempotency-Key replays the first response without debiting again', async () => {
      const userId = await newUser(200);
      const gold = thali('Gold thali');
      const key = randomUUID();
      const first = await as(userId).unlock(gold.id, key).expect(200);
      const again = await as(userId).unlock(gold.id, key).expect(200);
      expect(again.headers['idempotent-replayed']).toBe('true');
      expect(again.body.data).toEqual(first.body.data);
      expect(await unlockDebits(userId)).toHaveLength(1);
      expect(await coins.getBalance(userId)).toBe(92);
    });

    it('concurrent unlocks with different keys: exactly one debit, the rest 409', async () => {
      const userId = await newUser(500);
      const pancha = thali('Pancha-deep thali');
      const results = await Promise.all(Array.from({ length: 6 }, () => as(userId).unlock(pancha.id)));

      expect(results.map((r) => r.status).sort()).toEqual([200, 409, 409, 409, 409, 409]);
      expect(results.filter((r) => r.status === 409).every((r) => r.body.error.code === 'ALREADY_UNLOCKED')).toBe(true);
      expect(await unlockDebits(userId)).toHaveLength(1);
      expect(await unlockRows(userId)).toHaveLength(1);
      expect(await coins.getBalance(userId)).toBe(500 - 151);
    });

    it('concurrent requests with the same key: exactly one debit', async () => {
      const userId = await newUser(500);
      const key = randomUUID();
      const results = await Promise.all(Array.from({ length: 4 }, () => as(userId).unlock(thali('Gold thali').id, key)));

      expect(results.filter((r) => r.status === 200).length).toBeGreaterThanOrEqual(1);
      for (const r of results.filter((r) => r.status !== 200)) {
        expect(r.status).toBe(409);
        expect(r.body.error.code).toBe('IDEMPOTENCY_IN_PROGRESS');
      }
      expect(await unlockDebits(userId)).toHaveLength(1);
      expect(await coins.getBalance(userId)).toBe(500 - 108);
    });

    it('insufficient coins → 402 { required, balance }, nothing written', async () => {
      const userId = await newUser(100);
      const res = await as(userId).unlock(thali('Gold thali').id).expect(402);
      expect(res.body.error).toMatchObject({ code: 'COINS_INSUFFICIENT', details: { required: 108, balance: 100 } });
      expect(await unlockRows(userId)).toHaveLength(0);
      expect(await coins.getBalance(userId)).toBe(100);
    });

    it('unknown / inactive → 404 THALI_NOT_AVAILABLE; missing Idempotency-Key → 400', async () => {
      const userId = await newUser(200);
      expect((await as(userId).unlock(randomUUID()).expect(404)).body.error.code).toBe('THALI_NOT_AVAILABLE');
      await withInactive(thali('Silver thali'), async () => {
        expect((await as(userId).unlock(thali('Silver thali').id).expect(404)).body.error.code).toBe('THALI_NOT_AVAILABLE');
      });
      await as(userId).unlock('nope').expect(400);
      expect((await as(userId).unlock(thali('Silver thali').id, null).expect(400)).body.error.code).toBe(
        'IDEMPOTENCY_KEY_REQUIRED',
      );
      expect(await coins.getBalance(userId)).toBe(200);
    });
  });

  describe('PUT /v1/mandir/thali', () => {
    it('a locked thali cannot be selected (403 THALI_LOCKED); after unlocking it can', async () => {
      const userId = await newUser(200);
      const silver = thali('Silver thali');

      const locked = await as(userId).select(silver.id).expect(403);
      expect(locked.body.error).toMatchObject({ code: 'THALI_LOCKED', details: { thaliId: silver.id } });
      expect(await prisma.userMandirSettings.findUnique({ where: { userId } })).toBeNull();

      await as(userId).unlock(silver.id).expect(200);
      expect((await as(userId).select(silver.id).expect(200)).body.data).toEqual({ selectedThaliId: silver.id });

      const list = (await as(userId).list().expect(200)).body.data as ThaliList;
      expect(list.selectedThaliId).toBe(silver.id);
      expect(list.items.filter((t) => t.selected).map((t) => t.id)).toEqual([silver.id]);
      const home = (await as(userId).home().expect(200)).body.data;
      expect(home.thali).toEqual({
        id: silver.id,
        imageUrl: expect.stringMatching(/official\/thalis\/chaandi\/image\.webp$/),
        flameStyle: 'single',
      });

      // Free designs are always selectable.
      await as(userId).select(thali('Brass thali').id).expect(200);
    });

    it('unknown / inactive → 404 THALI_NOT_AVAILABLE', async () => {
      const userId = await newUser();
      expect((await as(userId).select(randomUUID()).expect(404)).body.error.code).toBe('THALI_NOT_AVAILABLE');
      await withInactive(thali('Brass thali'), async () => {
        expect((await as(userId).select(thali('Brass thali').id).expect(404)).body.error.code).toBe('THALI_NOT_AVAILABLE');
      });
    });

    it('deactivated or revoked selection falls back to the default free thali; unlock kept; reactivating restores it', async () => {
      const userId = await newUser(200);
      const silver = thali('Silver thali');
      await as(userId).unlock(silver.id).expect(200);
      await as(userId).select(silver.id).expect(200);

      await withInactive(silver, async () => {
        const list = (await as(userId).list().expect(200)).body.data as ThaliList;
        expect(list.selectedThaliId).toBe(thali('Brass thali').id);
        expect(list.items.map((t) => t.id)).not.toContain(silver.id);
        expect((await as(userId).home().expect(200)).body.data.thali.id).toBe(thali('Brass thali').id);
        expect(await unlockRows(userId)).toHaveLength(1);
      });
      expect(((await as(userId).list().expect(200)).body.data as ThaliList).selectedThaliId).toBe(silver.id);

      // Admin revoke = the unlock row is removed.
      await prisma.userUnlock.deleteMany({ where: { userId } });
      expect(((await as(userId).list().expect(200)).body.data as ThaliList).selectedThaliId).toBe(thali('Brass thali').id);
      expect((await as(userId).home().expect(200)).body.data.thali.id).toBe(thali('Brass thali').id);
    });
  });

  describe('aarti-complete records the thali', () => {
    it('request thaliId if usable, else the resolved selection; a locked one → 403, nothing written', async () => {
      const userId = await newUser(200);
      const silver = thali('Silver thali');
      const gold = thali('Gold thali');

      await as(userId).aarti().expect(200);
      await as(userId).unlock(silver.id).expect(200);
      await as(userId).aarti(silver.id).expect(200);
      await as(userId).select(silver.id).expect(200);
      await as(userId).aarti().expect(200);

      const denied = await as(userId).aarti(gold.id).expect(403);
      expect(denied.body.error.code).toBe('THALI_LOCKED');
      expect((await as(userId).aarti(randomUUID()).expect(404)).body.error.code).toBe('THALI_NOT_AVAILABLE');

      const logs = await prisma.ritualLog.findMany({
        where: { userId, action: 'AARTI_COMPLETE' },
        orderBy: { createdAt: 'asc' },
      });
      expect(logs.map((l) => l.thaliId)).toEqual([thali('Brass thali').id, silver.id, silver.id]);
    });
  });

  describe('mandir.thali_designs off', () => {
    it('routes → 403 FEATURE_DISABLED; home and aarti use the default free thali; selection kept', async () => {
      const userId = await newUser(200);
      const silver = thali('Silver thali');
      await as(userId).unlock(silver.id).expect(200);
      await as(userId).select(silver.id).expect(200);

      await setThaliFlag(false);
      try {
        for (const res of [
          await as(userId).list(),
          await as(userId).unlock(thali('Gold thali').id),
          await as(userId).select(thali('Brass thali').id),
        ]) {
          expect(res.status).toBe(403);
          expect(res.body.error.code).toBe('FEATURE_DISABLED');
        }
        expect((await as(userId).home().expect(200)).body.data.thali.id).toBe(thali('Brass thali').id);
        await as(userId).aarti(silver.id).expect(200);
        const log = await prisma.ritualLog.findFirstOrThrow({ where: { userId, action: 'AARTI_COMPLETE' } });
        expect(log.thaliId).toBe(thali('Brass thali').id);
      } finally {
        await setThaliFlag(true);
      }
      expect((await as(userId).home().expect(200)).body.data.thali.id).toBe(silver.id);
      // 200 − 51 (unlock) + 1 (FIRST_DARSHAN_OF_DAY) + 2 (AARTI_COMPLETE); the flag-off aarti spent nothing.
      expect(await coins.getBalance(userId)).toBe(152);
    });
  });
});
