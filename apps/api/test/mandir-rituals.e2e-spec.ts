import 'reflect-metadata';
import { randomUUID } from 'node:crypto';

import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import {
  type AartiCompleteResponse,
  type DarshanPingResponse,
  type DeityAartis,
  MandirFlag,
  REMOTE_CONFIG_FLAG_KEY,
  type StreakDetails,
} from '@mandir/shared-types';
import request from 'supertest';

import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/app.setup.js';
import { FeatureFlagService } from '../src/core/feature-flags/feature-flag.service.js';
import { PrismaService } from '../src/core/prisma/prisma.module.js';
import { addDays, localDateIn } from '../src/core/time/local-date.js';
import type { Aarti, Deity, Prisma } from '../src/generated/prisma/client.js';

const TZ = 'Asia/Kolkata';

// T7: aarti list, aarti-complete, darshan ping, /me/streak and streak badges (§6.3, §6.4, §7 "T7 contract notes").
// Timezone boundaries are unit-tested in src/modules/streaks/streak-timezone.spec.ts.
// Requires: pnpm dev:infra && pnpm db:migrate && pnpm db:seed, and DEV_AUTH=true in .env
describe('Mandir rituals + streak (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let flags: FeatureFlagService;
  const deities = new Map<string, Deity>();
  const defaultAarti = new Map<string, Aarti>();
  const createdUsers: string[] = [];
  const createdDeities: string[] = [];
  const createdAartis: string[] = [];

  const api = () => request(app.getHttpServer());
  const deity = (slug: string) => deities.get(slug)!;
  const aartiOf = (slug: string) => defaultAarti.get(slug)!;
  const complete = { playedRatio: 1, circles: 3 };
  const as = (userId: string) => ({
    aartis: (deityId: string) => api().get(`/v1/deities/${deityId}/aartis`).set('X-Dev-User', userId),
    aartiComplete: (body: Record<string, unknown>, key: string | null = randomUUID()) => {
      const req = api().post('/v1/mandir/rituals/aarti-complete').set('X-Dev-User', userId);
      if (key) req.set('Idempotency-Key', key);
      return req.send(body);
    },
    completeAarti: (slug: string) =>
      as(userId).aartiComplete({ deityId: deity(slug).id, aartiId: aartiOf(slug).id, ...complete }),
    darshan: (deityId: string, seconds = 20) =>
      api().post('/v1/mandir/rituals/darshan').set('X-Dev-User', userId).send({ deityId, seconds }),
    offer: (deityId: string, offeringItemId: string) =>
      api()
        .post('/v1/mandir/offerings')
        .set('X-Dev-User', userId)
        .set('Idempotency-Key', randomUUID())
        .send({ deityId, offeringItemId }),
    streak: (month?: string) =>
      api()
        .get('/v1/me/streak')
        .query(month ? { month } : {})
        .set('X-Dev-User', userId),
  });

  async function newUser(streak?: { current: number; longest?: number; lastDate: string }): Promise<string> {
    const user = await prisma.user.create({ data: { name: `T7 ${randomUUID().slice(0, 8)}`, timezone: TZ } });
    createdUsers.push(user.id);
    if (streak) {
      await prisma.userStreak.create({ data: { userId: user.id, longest: streak.current, ...streak } });
    }
    return user.id;
  }

  const logs = (userId: string, action: 'AARTI_COMPLETE' | 'DARSHAN') =>
    prisma.ritualLog.findMany({ where: { userId, action } });
  const rewardRows = (userId: string) =>
    prisma.coinTransaction.findMany({ where: { userId, reason: 'REWARD' }, orderBy: { createdAt: 'asc' } });

  async function withFlag(key: string, update: Prisma.FeatureFlagUpdateInput, fn: () => Promise<void>) {
    const before = await prisma.featureFlag.findUniqueOrThrow({ where: { key } });
    await prisma.featureFlag.update({ where: { key }, data: update });
    flags.invalidate();
    try {
      await fn();
    } finally {
      await prisma.featureFlag.update({
        where: { key },
        data: {
          enabled: before.enabled,
          rolloutPercent: before.rolloutPercent,
          payload: (before.payload ?? undefined) as Prisma.InputJsonValue | undefined,
        },
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
    for (const d of await prisma.deity.findMany()) deities.set(d.slug, d);
    for (const a of await prisma.aarti.findMany({ where: { isDefault: true }, include: { deity: true } })) {
      defaultAarti.set(a.deity.slug, a);
    }
  });

  afterAll(async () => {
    if (prisma) {
      await prisma.coinTransaction.deleteMany({ where: { userId: { in: createdUsers } } });
      await prisma.ritualLog.deleteMany({ where: { userId: { in: createdUsers } } });
      await prisma.user.deleteMany({ where: { id: { in: createdUsers } } });
      await prisma.aarti.deleteMany({ where: { id: { in: createdAartis } } });
      await prisma.deity.deleteMany({ where: { id: { in: createdDeities } } });
    }
    await app?.close();
  });

  describe('GET /v1/deities/:deityId/aartis', () => {
    it('active aartis with CDN URLs, default first then newest version', async () => {
      const userId = await newUser();
      const hanuman = deity('hanuman');
      const seeded = aartiOf('hanuman');
      const extra = await prisma.aarti.create({
        data: { ...pick(seeded), titleEn: 'T7 extra', version: 2, isDefault: false },
      });
      const inactive = await prisma.aarti.create({
        data: { ...pick(seeded), titleEn: 'T7 inactive', version: 3, isDefault: false, isActive: false },
      });
      createdAartis.push(extra.id, inactive.id);

      const body = (await as(userId).aartis(hanuman.id).expect(200)).body.data as DeityAartis;
      expect(body.deityId).toBe(hanuman.id);
      expect(body.items.map((a) => a.id)).toEqual([seeded.id, extra.id]);
      expect(body.items[0]).toEqual({
        id: seeded.id,
        titleHi: seeded.titleHi,
        titleEn: seeded.titleEn,
        audioUrl: expect.stringMatching(new RegExp(`^http.*${escape(seeded.audioKey)}$`)),
        lyricsUrl: expect.stringMatching(new RegExp(`^http.*${escape(seeded.lyricsKey)}$`)),
        durationSec: seeded.durationSec,
        version: 1,
        isDefault: true,
      });
    });

    it('unknown / inactive deity → 404 DEITY_NOT_AVAILABLE; bad id → 400', async () => {
      const userId = await newUser();
      const inactive = await prisma.deity.create({
        data: { slug: `t7-inactive-${randomUUID().slice(0, 8)}`, nameHi: 'x', nameEn: 'x', isActive: false },
      });
      createdDeities.push(inactive.id);
      for (const id of [randomUUID(), inactive.id]) {
        expect((await as(userId).aartis(id).expect(404)).body.error.code).toBe('DEITY_NOT_AVAILABLE');
      }
      await as(userId).aartis('nope').expect(400);
    });
  });

  describe('POST /v1/mandir/rituals/aarti-complete', () => {
    it('logs the aarti, counts the darshan day, pays FIRST_DARSHAN_OF_DAY + AARTI_COMPLETE', async () => {
      const userId = await newUser();
      const res = await as(userId).completeAarti('shiv').expect(200);
      const body = res.body.data as AartiCompleteResponse;

      expect(body).toEqual({
        ritualLogId: expect.any(String),
        coinsBalance: 3,
        streak: { current: 1, longest: 1, doneToday: true },
        rewards: [
          { ruleKey: 'FIRST_DARSHAN_OF_DAY', coins: 1 },
          { ruleKey: 'AARTI_COMPLETE', coins: 2 },
        ],
        badgesEarned: [],
      });
      const [log] = await logs(userId, 'AARTI_COMPLETE');
      expect(log).toMatchObject({
        id: body.ritualLogId,
        deityId: deity('shiv').id,
        aartiId: aartiOf('shiv').id,
        coinsSpent: 0,
        localDate: localDateIn(TZ),
      });

      const home = (await api().get('/v1/mandir/home').set('X-Dev-User', userId).expect(200)).body.data;
      expect(home.streak).toEqual({ current: 1, longest: 1, doneToday: true });
      expect(home.coins).toEqual({ balance: 3 });
    });

    it('AARTI_COMPLETE pays at most 2× per day; later completions still log', async () => {
      const userId = await newUser();
      const bodies: AartiCompleteResponse[] = [];
      for (let i = 0; i < 3; i++) bodies.push((await as(userId).completeAarti('ganesh').expect(200)).body.data);

      expect(bodies.map((b) => b.rewards.map((r) => r.ruleKey))).toEqual([
        ['FIRST_DARSHAN_OF_DAY', 'AARTI_COMPLETE'],
        ['AARTI_COMPLETE'],
        [],
      ]);
      expect(bodies[2]!.coinsBalance).toBe(5);
      expect(await logs(userId, 'AARTI_COMPLETE')).toHaveLength(3);
      expect(await rewardRows(userId)).toHaveLength(3);
    });

    it('completion rule: < 90% played or < 3 circles → 422 AARTI_INCOMPLETE, nothing written; boundary passes', async () => {
      const userId = await newUser();
      const base = { deityId: deity('shiv').id, aartiId: aartiOf('shiv').id };
      for (const partial of [
        { playedRatio: 0.89, circles: 10 },
        { playedRatio: 1, circles: 2 },
      ]) {
        const res = await as(userId).aartiComplete({ ...base, ...partial }).expect(422);
        expect(res.body.error).toMatchObject({
          code: 'AARTI_INCOMPLETE',
          details: { ...partial, minPlayedRatio: 0.9, minCircles: 3 },
        });
      }
      expect(await logs(userId, 'AARTI_COMPLETE')).toHaveLength(0);
      expect(await prisma.userStreak.findUnique({ where: { userId } })).toBeNull();
      expect(await rewardRows(userId)).toHaveLength(0);

      await as(userId).aartiComplete({ ...base, playedRatio: 0.9, circles: 3 }).expect(200);
    });

    it('aarti of another deity / unknown / inactive → 404 AARTI_NOT_AVAILABLE; inactive deity → 404 DEITY_NOT_AVAILABLE', async () => {
      const userId = await newUser();
      const inactive = await prisma.aarti.create({
        data: { ...pick(aartiOf('shiv')), titleEn: 'T7 inactive', version: 9, isDefault: false, isActive: false },
      });
      createdAartis.push(inactive.id);
      for (const aartiId of [aartiOf('hanuman').id, randomUUID(), inactive.id]) {
        const res = await as(userId).aartiComplete({ deityId: deity('shiv').id, aartiId, ...complete }).expect(404);
        expect(res.body.error.code).toBe('AARTI_NOT_AVAILABLE');
      }
      const res = await as(userId).aartiComplete({ deityId: randomUUID(), aartiId: aartiOf('shiv').id, ...complete });
      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('DEITY_NOT_AVAILABLE');
      await as(userId).aartiComplete({ deityId: deity('shiv').id, aartiId: aartiOf('shiv').id, playedRatio: 2, circles: 3 }).expect(400);
    });

    it('requires Idempotency-Key; a repeated key replays without logging or paying again', async () => {
      const userId = await newUser();
      const body = { deityId: deity('vishnu').id, aartiId: aartiOf('vishnu').id, ...complete };
      expect((await as(userId).aartiComplete(body, null).expect(400)).body.error.code).toBe('IDEMPOTENCY_KEY_REQUIRED');

      const key = randomUUID();
      const first = await as(userId).aartiComplete(body, key).expect(200);
      const again = await as(userId).aartiComplete(body, key).expect(200);
      expect(again.headers['idempotent-replayed']).toBe('true');
      expect(again.body.data).toEqual(first.body.data);
      expect(await logs(userId, 'AARTI_COMPLETE')).toHaveLength(1);
      expect(await rewardRows(userId)).toHaveLength(2);
    });

    it('mandir.rewards off → streak counted, no rewards', async () => {
      const userId = await newUser();
      await withFlag(MandirFlag.REWARDS, { enabled: false }, async () => {
        const body = (await as(userId).completeAarti('surya').expect(200)).body.data as AartiCompleteResponse;
        expect(body).toMatchObject({ rewards: [], coinsBalance: 0, streak: { current: 1, doneToday: true } });
      });
      expect(await rewardRows(userId)).toHaveLength(0);
    });
  });

  describe('POST /v1/mandir/rituals/darshan', () => {
    it('counts the day once: one DARSHAN log and FIRST_DARSHAN_OF_DAY; repeat is a no-op', async () => {
      const userId = await newUser();
      const first = (await as(userId).darshan(deity('ram').id, 25).expect(200)).body.data as DarshanPingResponse;
      expect(first).toEqual({
        counted: true,
        coinsBalance: 1,
        streak: { current: 1, longest: 1, doneToday: true },
        rewards: [{ ruleKey: 'FIRST_DARSHAN_OF_DAY', coins: 1 }],
        badgesEarned: [],
      });
      const again = (await as(userId).darshan(deity('krishna').id).expect(200)).body.data as DarshanPingResponse;
      expect(again).toMatchObject({ counted: true, coinsBalance: 1, rewards: [] });

      const [log, ...rest] = await logs(userId, 'DARSHAN');
      expect(rest).toHaveLength(0);
      expect(log).toMatchObject({ deityId: deity('ram').id, localDate: localDateIn(TZ) });
    });

    it('after an offering the ping pays nothing more', async () => {
      const userId = await newUser();
      const marigold = await prisma.offeringItem.findFirstOrThrow({ where: { nameEn: 'Marigold' } });
      await as(userId).offer(deity('ram').id, marigold.id).expect(200);
      const body = (await as(userId).darshan(deity('ram').id).expect(200)).body.data as DarshanPingResponse;
      expect(body).toMatchObject({ counted: true, rewards: [], coinsBalance: 1, streak: { current: 1 } });
    });

    it('shorter than darshanPingSeconds → 422 DARSHAN_TOO_SHORT, nothing written', async () => {
      const userId = await newUser();
      const res = await as(userId).darshan(deity('ram').id, 19).expect(422);
      expect(res.body.error).toMatchObject({ code: 'DARSHAN_TOO_SHORT', details: { seconds: 19, minSeconds: 20 } });
      expect(await logs(userId, 'DARSHAN')).toHaveLength(0);
      expect(await prisma.userStreak.findUnique({ where: { userId } })).toBeNull();
    });

    it('darshanPingSeconds: null → counted false, nothing written; a custom value is honoured', async () => {
      const userId = await newUser();
      const remote = await prisma.featureFlag.findUniqueOrThrow({ where: { key: REMOTE_CONFIG_FLAG_KEY } });
      const payload = (remote.payload ?? {}) as Prisma.JsonObject;

      await withFlag(REMOTE_CONFIG_FLAG_KEY, { payload: { ...payload, darshanPingSeconds: null } }, async () => {
        const body = (await as(userId).darshan(deity('ram').id, 600).expect(200)).body.data as DarshanPingResponse;
        expect(body).toEqual({
          counted: false,
          coinsBalance: 0,
          streak: { current: 0, longest: 0, doneToday: false },
          rewards: [],
          badgesEarned: [],
        });
      });
      expect(await logs(userId, 'DARSHAN')).toHaveLength(0);

      await withFlag(REMOTE_CONFIG_FLAG_KEY, { payload: { ...payload, darshanPingSeconds: 45 } }, async () => {
        await as(userId).darshan(deity('ram').id, 30).expect(422);
        await as(userId).darshan(deity('ram').id, 45).expect(200);
      });
    });

    it('unknown deity → 404; negative seconds → 400', async () => {
      const userId = await newUser();
      expect((await as(userId).darshan(randomUUID()).expect(404)).body.error.code).toBe('DEITY_NOT_AVAILABLE');
      await as(userId).darshan(deity('ram').id, -1).expect(400);
    });
  });

  describe('streak badges + milestone rewards', () => {
    it('reaching 7 days earns STREAK_7 and pays it once', async () => {
      const today = localDateIn(TZ);
      const userId = await newUser({ current: 6, lastDate: addDays(today, -1) });

      const body = (await as(userId).completeAarti('hanuman').expect(200)).body.data as AartiCompleteResponse;
      expect(body.streak).toEqual({ current: 7, longest: 7, doneToday: true });
      expect(body.badgesEarned).toEqual(['STREAK_7']);
      expect(body.rewards).toEqual([
        { ruleKey: 'FIRST_DARSHAN_OF_DAY', coins: 1 },
        { ruleKey: 'STREAK_7', coins: 10 },
        { ruleKey: 'AARTI_COMPLETE', coins: 2 },
      ]);
      expect(body.coinsBalance).toBe(13);

      const again = (await as(userId).darshan(deity('hanuman').id).expect(200)).body.data as DarshanPingResponse;
      expect(again).toMatchObject({ badgesEarned: [], rewards: [] });
      expect(await prisma.userBadge.findMany({ where: { userId } })).toHaveLength(1);
    });

    it('offerings report badges too; missing lower badges are caught up', async () => {
      const today = localDateIn(TZ);
      const userId = await newUser({ current: 20, lastDate: addDays(today, -1) });
      const marigold = await prisma.offeringItem.findFirstOrThrow({ where: { nameEn: 'Marigold' } });

      const body = (await as(userId).offer(deity('ganesh').id, marigold.id).expect(200)).body.data;
      expect(body.badgesEarned).toEqual(['STREAK_7', 'STREAK_21']);
      expect(body.rewards).toEqual([
        { ruleKey: 'FIRST_DARSHAN_OF_DAY', coins: 1 },
        { ruleKey: 'STREAK_7', coins: 10 },
        { ruleKey: 'STREAK_21', coins: 25 },
      ]);
      expect(body.reward).toEqual({ ruleKey: 'FIRST_DARSHAN_OF_DAY', coins: 1 });
      expect(body.coinsBalance).toBe(36);
    });

    it('a milestone reward already paid is not paid again when the streak restarts and reaches it again', async () => {
      const today = localDateIn(TZ);
      const userId = await newUser({ current: 6, lastDate: addDays(today, -1) });
      await as(userId).darshan(deity('shani').id).expect(200);
      // Streak broken and rebuilt to 6 by yesterday; badge kept.
      await prisma.userStreak.update({ where: { userId }, data: { current: 6, lastDate: addDays(today, -1) } });
      await prisma.coinTransaction.updateMany({
        where: { userId, refId: 'FIRST_DARSHAN_OF_DAY' },
        data: { createdAt: new Date(Date.now() - 2 * 86_400_000) },
      });
      const body = (await as(userId).darshan(deity('shani').id).expect(200)).body.data as DarshanPingResponse;
      expect(body.streak.current).toBe(7);
      expect(body).toMatchObject({ badgesEarned: [], rewards: [{ ruleKey: 'FIRST_DARSHAN_OF_DAY', coins: 1 }] });
    });
  });

  describe('GET /v1/me/streak', () => {
    it('new user: zeros, no badges, current local month with no days', async () => {
      const userId = await newUser();
      const body = (await as(userId).streak().expect(200)).body.data as StreakDetails;
      expect(body).toEqual({
        current: 0,
        longest: 0,
        doneToday: false,
        badges: [],
        calendar: { month: localDateIn(TZ).slice(0, 7), days: [] },
      });
    });

    it('calendar lists distinct darshan days of the month; bells and other months are left out', async () => {
      const userId = await newUser({ current: 3, longest: 8, lastDate: localDateIn(TZ) });
      const d = deity('lakshmi').id;
      const row = (localDate: string, action: 'OFFERING' | 'AARTI_COMPLETE' | 'DARSHAN' | 'BELL') => ({
        userId,
        deityId: d,
        action,
        localDate,
      });
      await prisma.ritualLog.createMany({
        data: [
          row('2026-02-28', 'OFFERING'),
          row('2026-02-28', 'AARTI_COMPLETE'),
          row('2026-02-01', 'DARSHAN'),
          row('2026-02-14', 'BELL'),
          row('2026-01-31', 'OFFERING'),
          row('2026-03-01', 'OFFERING'),
        ],
      });
      await prisma.userBadge.createMany({
        data: [
          { userId, badgeKey: 'STREAK_21', earnedAt: new Date('2026-02-10T00:00:00Z') },
          { userId, badgeKey: 'STREAK_7', earnedAt: new Date('2026-01-20T00:00:00Z') },
        ],
      });

      const body = (await as(userId).streak('2026-02').expect(200)).body.data as StreakDetails;
      expect(body).toEqual({
        current: 3,
        longest: 8,
        doneToday: true,
        badges: [
          { key: 'STREAK_7', earnedAt: '2026-01-20T00:00:00.000Z' },
          { key: 'STREAK_21', earnedAt: '2026-02-10T00:00:00.000Z' },
        ],
        calendar: { month: '2026-02', days: ['2026-02-01', '2026-02-28'] },
      });
    });

    it('bad month → 400', async () => {
      const userId = await newUser();
      for (const month of ['2026-13', '2026-9', 'x']) await as(userId).streak(month).expect(400);
    });
  });
});

/** Aarti columns for a copy of a seeded aarti. */
function pick(a: Aarti) {
  return { deityId: a.deityId, titleHi: a.titleHi, audioKey: a.audioKey, lyricsKey: a.lyricsKey, durationSec: a.durationSec };
}

function escape(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
