import 'reflect-metadata';
import { randomUUID } from 'node:crypto';

import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { MandirFlag, type MandirHome } from '@mandir/shared-types';
import request from 'supertest';

import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/app.setup.js';
import { DEV_USERS } from '../src/core/auth/dev-users.js';
import { FeatureFlagService } from '../src/core/feature-flags/feature-flag.service.js';
import { PrismaService } from '../src/core/prisma/prisma.module.js';
import type { Deity } from '../src/generated/prisma/client.js';

// T4: home + deities APIs — default deity logic (§6.1) and image fallback (§6.2).
// Requires: pnpm dev:infra && pnpm db:migrate && pnpm db:seed, and DEV_AUTH=true in .env
describe('Mandir home + deities (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let flags: FeatureFlagService;
  const bySlug = new Map<string, Deity>();
  const createdUsers: string[] = [];
  const createdThemes: string[] = [];
  const createdDeities: string[] = [];

  const api = () => request(app.getHttpServer());
  const as = (userId: string) => ({
    get: (path: string) => api().get(path).set('X-Dev-User', userId),
    put: (path: string, body: object) => api().put(path).set('X-Dev-User', userId).send(body),
  });
  const deity = (slug: string) => bySlug.get(slug)!;

  async function newUser(): Promise<string> {
    const user = await prisma.user.create({ data: { name: `T4 ${randomUUID().slice(0, 8)}`, timezone: 'Asia/Kolkata' } });
    createdUsers.push(user.id);
    return user.id;
  }

  async function home(userId: string): Promise<MandirHome> {
    const res = await as(userId).get('/v1/mandir/home').expect(200);
    return res.body.data as MandirHome;
  }

  const imageOf = (h: MandirHome, deityId: string) => h.deities.find((d) => d.id === deityId)?.image ?? null;

  /** An image row for tests; objects need not exist in storage (URLs are only built). */
  async function newImage(data: {
    deityId: string;
    uploadedById: string | null;
    status: 'PUBLIC' | 'PRIVATE' | 'PROCESSING' | 'REJECTED' | 'REMOVED';
    source?: 'COMMUNITY' | 'HOME_MANDIR';
    isFeatured?: boolean;
  }) {
    const id = randomUUID();
    const isPublic = data.status === 'PUBLIC';
    const base = isPublic ? `community/public/${id}` : `community/pending/${id}`;
    return prisma.deityImage.create({
      data: {
        id,
        deityId: data.deityId,
        uploadedById: data.uploadedById,
        source: data.source ?? 'COMMUNITY',
        status: data.status,
        isFeatured: data.isFeatured ?? false,
        objectKey: `${base}/original.jpg`,
        variants: isPublic
          ? { thumb: `${base}/thumb.webp`, card: `${base}/card.webp`, full: `${base}/full.webp`, hd: `${base}/hd.webp` }
          : undefined,
        creditName: 'Ramesh',
      },
    });
  }

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);
    flags = app.get(FeatureFlagService);
    for (const d of await prisma.deity.findMany()) bySlug.set(d.slug, d);
  });

  afterAll(async () => {
    if (prisma) {
      await prisma.theme.deleteMany({ where: { id: { in: createdThemes } } });
      await prisma.userDeity.deleteMany({ where: { userId: { in: createdUsers } } });
      await prisma.ritualLog.deleteMany({ where: { userId: { in: createdUsers } } });
      await prisma.deityImage.deleteMany({ where: { uploadedById: { in: createdUsers } } });
      await prisma.deityImage.deleteMany({ where: { deityId: { in: createdDeities } } });
      await prisma.deity.deleteMany({ where: { id: { in: createdDeities } } });
      await prisma.user.deleteMany({ where: { id: { in: createdUsers } } });
    }
    await app?.close();
  });

  describe('default deity of the day (§6.1)', () => {
    it("new user: all active deities by sort order, default = today's weekday deity", async () => {
      const userId = await newUser();
      const h = await home(userId);

      const active = await prisma.deity.findMany({ where: { isActive: true }, orderBy: [{ sortOrder: 'asc' }, { nameEn: 'asc' }] });
      expect(h.deities.map((d) => d.id)).toEqual(active.map((d) => d.id));
      expect(h.deities.map((d) => d.position)).toEqual(active.map((_, i) => i));

      const weekdayDeity = active.find((d) => d.weekday === h.today.weekday)!;
      expect(h.defaultDeityId).toBe(weekdayDeity.id);
      expect(h.today.localDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(new Date(`${h.today.localDate}T00:00:00Z`).getUTCDay()).toBe(h.today.weekday);
      expect(h.today.tithiText).toMatch(/पक्ष/);
    });

    it('weekday deity in mandir (not first) → weekday deity; not in mandir → first by position', async () => {
      const userId = await newUser();
      const { today } = await home(userId);
      const weekdayDeity = [...bySlug.values()].find((d) => d.weekday === today.weekday)!;
      const others = [...bySlug.values()].filter((d) => d.weekday === null).slice(0, 2);

      await as(userId)
        .put('/v1/mandir/deities', {
          items: [
            { deityId: others[0]!.id, position: 0 },
            { deityId: weekdayDeity.id, position: 1 },
          ],
        })
        .expect(200);
      expect((await home(userId)).defaultDeityId).toBe(weekdayDeity.id);

      await as(userId)
        .put('/v1/mandir/deities', {
          items: [
            { deityId: others[1]!.id, position: 3 },
            { deityId: others[0]!.id, position: 1 },
          ],
        })
        .expect(200);
      const h = await home(userId);
      expect(h.deities.map((d) => d.id)).toEqual([others[0]!.id, others[1]!.id]);
      expect(h.defaultDeityId).toBe(others[0]!.id);
    });

    it('pinned deity wins over the weekday deity', async () => {
      const userId = await newUser();
      const { today } = await home(userId);
      const weekdayDeity = [...bySlug.values()].find((d) => d.weekday === today.weekday)!;
      const pinned = deity('krishna');

      await as(userId)
        .put('/v1/mandir/deities', {
          items: [
            { deityId: weekdayDeity.id, position: 0 },
            { deityId: pinned.id, position: 1, isPinned: true },
          ],
        })
        .expect(200);
      const h = await home(userId);
      expect(h.defaultDeityId).toBe(pinned.id);
      expect(h.deities.find((d) => d.id === pinned.id)?.isPinned).toBe(true);
    });

    it('running festival theme overrides the weekday deity (flag on), not a pinned one', async () => {
      const userId = await newUser();
      const durga = deity('durga');
      const flagBefore = await prisma.featureFlag.findUniqueOrThrow({ where: { key: MandirFlag.FESTIVAL_THEMES } });
      const defaultTheme = await prisma.theme.findUniqueOrThrow({ where: { key: 'default' } });
      const theme = await prisma.theme.create({
        data: {
          key: `t4-navratri-${randomUUID().slice(0, 8)}`,
          frameKey: defaultTheme.frameKey,
          colors: { primary: '#C62828' },
          deityIds: [durga.id],
          isActive: true,
          startsAt: new Date(Date.now() - 86_400_000),
          endsAt: new Date(Date.now() + 86_400_000),
        },
      });
      createdThemes.push(theme.id);

      try {
        expect((await home(userId)).theme?.key).toBe('default'); // flag still as seeded (off)

        await prisma.featureFlag.update({ where: { key: MandirFlag.FESTIVAL_THEMES }, data: { enabled: true, rolloutPercent: 100 } });
        flags.invalidate();
        let h = await home(userId);
        expect(h.theme).toMatchObject({ key: theme.key, deityIds: [durga.id] });
        expect(h.defaultDeityId).toBe(durga.id);

        await as(userId)
          .put('/v1/mandir/deities', {
            items: [
              { deityId: durga.id, position: 0 },
              { deityId: deity('ram').id, position: 1, isPinned: true },
            ],
          })
          .expect(200);
        h = await home(userId);
        expect(h.defaultDeityId).toBe(deity('ram').id);
      } finally {
        await prisma.featureFlag.update({
          where: { key: MandirFlag.FESTIVAL_THEMES },
          data: { enabled: flagBefore.enabled, rolloutPercent: flagBefore.rolloutPercent },
        });
        flags.invalidate();
      }
    });
  });

  describe('home payload', () => {
    it('returns theme, coins, streak, special offering, aarti and today offerings (no free-offering limits)', async () => {
      const userId = await newUser();
      const hanuman = deity('hanuman');
      const flower = await prisma.offeringItem.findFirstOrThrow({ where: { kind: 'FLOWER', coinCost: 0 } });
      const diya = await prisma.offeringItem.findFirstOrThrow({ where: { kind: 'DIYA' } });
      const { today } = await home(userId);
      await prisma.ritualLog.createMany({
        data: [flower, flower, diya].map((item) => ({
          userId,
          deityId: hanuman.id,
          action: 'OFFERING' as const,
          offeringItemId: item.id,
          localDate: today.localDate,
        })),
      });

      const h = await home(userId);
      expect(h.theme).toMatchObject({ key: 'default', frameUrl: expect.stringContaining('themes/default/') });
      expect(h.coins).toEqual({ balance: 0 });
      expect(h.streak).toEqual({ current: 0, longest: 0, doneToday: false });
      expect(h).not.toHaveProperty('limits');
      expect(Object.keys(h.todayOfferings).sort()).toEqual(h.deities.map((d) => d.id).sort());
      expect(h.todayOfferings[hanuman.id]).toEqual({ flowers: 2, mala: false, diya: true, bhog: false });
      expect(h.todayOfferings[deity('shiv').id]).toEqual({ flowers: 0, mala: false, diya: false, bhog: false });

      const hanumanHome = h.deities.find((d) => d.id === hanuman.id)!;
      expect(hanumanHome.specialOffering).toMatchObject({ nameEn: 'Sindoor', iconUrl: expect.stringMatching(/^http/) });
      const aarti = await prisma.aarti.findFirstOrThrow({ where: { deityId: hanuman.id, isDefault: true } });
      expect(hanumanHome.defaultAartiId).toBe(aarti.id);
      expect(h.deities.find((d) => d.slug === 'ganesh')!.specialOffering).toBeNull();
    });

    it('dev-user sees its seeded coin balance', async () => {
      const res = await api().get('/v1/mandir/home').set('X-Dev-User', 'dev-user').expect(200);
      const wallet = await prisma.coinWallet.findUniqueOrThrow({ where: { userId: DEV_USERS['dev-user'].id } });
      expect(res.body.data.coins.balance).toBe(wallet.balance);
    });
  });

  describe('image resolution (§6.2)', () => {
    it('falls back selected → featured PUBLIC → deity default → bundled (null)', async () => {
      const owner = await newUser();
      const other = await newUser();
      const shiv = deity('shiv');

      // 1. Nothing selected, nothing featured → the deity's official default image.
      let h = await home(owner);
      expect(imageOf(h, shiv.id)).toMatchObject({ id: shiv.defaultImageId, source: 'OFFICIAL', status: 'PUBLIC' });
      expect(imageOf(h, shiv.id)!.urls.card).toMatch(/card\.webp$/);
      expect(imageOf(h, shiv.id)!.anchor).toEqual({ x: 0.5, y: 0.35 });

      // 2. A featured PUBLIC community image beats the default.
      const featured = await newImage({ deityId: shiv.id, uploadedById: other, status: 'PUBLIC', isFeatured: true });
      h = await home(owner);
      expect(imageOf(h, shiv.id)).toMatchObject({ id: featured.id, source: 'COMMUNITY', credit: { name: 'Ramesh' } });

      // 3. The owner's own PRIVATE upload, once selected, beats featured (signed URL, never CDN).
      const mine = await newImage({ deityId: shiv.id, uploadedById: owner, status: 'PRIVATE' });
      const set = await as(owner).put(`/v1/mandir/deities/${shiv.id}/image`, { imageId: mine.id }).expect(200);
      expect(set.body.data.image).toMatchObject({ id: mine.id, status: 'PRIVATE' });
      expect(set.body.data.image.urls.full).toMatch(/X-Amz-Signature=/);
      h = await home(owner);
      expect(imageOf(h, shiv.id)?.id).toBe(mine.id);
      // Selecting an image saved the implicit default list instead of shrinking the mandir.
      expect(h.deities.length).toBe(await prisma.deity.count({ where: { isActive: true } }));

      // 4. Another user can neither see nor set it.
      expect(imageOf(await home(other), shiv.id)?.id).toBe(featured.id);
      const denied = await as(other).put(`/v1/mandir/deities/${shiv.id}/image`, { imageId: mine.id }).expect(404);
      expect(denied.body.error.code).toBe('IMAGE_NOT_AVAILABLE');

      // 5. Selected image leaves the usable states → automatic fallback to featured.
      await prisma.deityImage.update({ where: { id: mine.id }, data: { status: 'REJECTED' } });
      expect(imageOf(await home(owner), shiv.id)?.id).toBe(featured.id);

      // 6. Other user selected the featured public image; it gets REMOVED → back to default.
      await as(other).put(`/v1/mandir/deities/${shiv.id}/image`, { imageId: featured.id }).expect(200);
      expect(imageOf(await home(other), shiv.id)?.id).toBe(featured.id);
      await prisma.deityImage.update({ where: { id: featured.id }, data: { status: 'REMOVED' } });
      expect(imageOf(await home(other), shiv.id)?.id).toBe(shiv.defaultImageId);

      // 7. null resets the selection.
      const reset = await as(owner).put(`/v1/mandir/deities/${shiv.id}/image`, { imageId: null }).expect(200);
      expect(reset.body.data.image.id).toBe(shiv.defaultImageId);
      expect((await prisma.userDeity.findUniqueOrThrow({ where: { userId_deityId: { userId: owner, deityId: shiv.id } } })).selectedImageId).toBeNull();
    });

    it("owner's PROCESSING upload is usable immediately (original served for every size)", async () => {
      const owner = await newUser();
      const ganesh = deity('ganesh');
      const img = await newImage({ deityId: ganesh.id, uploadedById: owner, status: 'PROCESSING', source: 'HOME_MANDIR' });
      const res = await as(owner).put(`/v1/mandir/deities/${ganesh.id}/image`, { imageId: img.id }).expect(200);
      expect(res.body.data.image).toMatchObject({ id: img.id, status: 'PROCESSING', source: 'HOME_MANDIR' });
      const urls = res.body.data.image.urls as Record<string, string>;
      for (const url of Object.values(urls)) expect(url).toContain('original.jpg');
    });

    it('deity without default or featured image → null (bundled fallback)', async () => {
      const userId = await newUser();
      const bare = await prisma.deity.create({
        data: { slug: `t4-bare-${randomUUID().slice(0, 8)}`, nameHi: 'परीक्षण', nameEn: 'Test', sortOrder: 999 },
      });
      createdDeities.push(bare.id);
      await as(userId).put('/v1/mandir/deities', { items: [{ deityId: bare.id, position: 0 }] }).expect(200);
      const h = await home(userId);
      expect(h.deities).toHaveLength(1);
      expect(h.deities[0]!.image).toBeNull();
      expect(h.deities[0]!.defaultAartiId).toBeNull();
    });

    it('rejects images of another deity and deities outside the mandir', async () => {
      const userId = await newUser();
      const shiv = deity('shiv');
      const hanuman = deity('hanuman');
      const wrongDeity = await as(userId)
        .put(`/v1/mandir/deities/${shiv.id}/image`, { imageId: hanuman.defaultImageId })
        .expect(404);
      expect(wrongDeity.body.error.code).toBe('IMAGE_NOT_AVAILABLE');

      await as(userId).put('/v1/mandir/deities', { items: [{ deityId: hanuman.id, position: 0 }] }).expect(200);
      const notInMandir = await as(userId).put(`/v1/mandir/deities/${shiv.id}/image`, { imageId: null }).expect(409);
      expect(notInMandir.body.error.code).toBe('DEITY_NOT_IN_MANDIR');
    });
  });

  describe('PUT /mandir/deities + GET /deities', () => {
    it('keeps image selections of kept deities and returns the sorted list', async () => {
      const userId = await newUser();
      const [shiv, ram] = [deity('shiv'), deity('ram')];
      const mine = await newImage({ deityId: shiv.id, uploadedById: userId, status: 'PRIVATE' });
      await as(userId).put(`/v1/mandir/deities/${shiv.id}/image`, { imageId: mine.id }).expect(200);

      const res = await as(userId)
        .put('/v1/mandir/deities', {
          items: [
            { deityId: ram.id, position: 5 },
            { deityId: shiv.id, position: 2, isPinned: true },
          ],
        })
        .expect(200);
      expect(res.body.data.items).toEqual([
        { deityId: shiv.id, position: 2, isPinned: true },
        { deityId: ram.id, position: 5, isPinned: false },
      ]);
      expect(imageOf(await home(userId), shiv.id)?.id).toBe(mine.id);

      const list = await as(userId).get('/v1/deities').expect(200);
      const items = list.body.data as { id: string; inMandir: boolean; image: { id: string } | null }[];
      expect(items.length).toBe(await prisma.deity.count({ where: { isActive: true } }));
      expect(items.filter((d) => d.inMandir).map((d) => d.id).sort()).toEqual([shiv.id, ram.id].sort());
      expect(items.find((d) => d.id === shiv.id)!.image?.id).toBe(mine.id);
      expect(items.find((d) => d.id === deity('ganesh').id)!.image?.id).toBe(deity('ganesh').defaultImageId);
    });

    it('validates the list', async () => {
      const userId = await newUser();
      const shiv = deity('shiv');
      const cases = [
        { items: [] },
        { items: [{ deityId: shiv.id, position: 0 }, { deityId: shiv.id, position: 1 }] },
        {
          items: [
            { deityId: shiv.id, position: 0, isPinned: true },
            { deityId: deity('ram').id, position: 1, isPinned: true },
          ],
        },
        { items: [{ deityId: 'not-a-uuid', position: 0 }] },
      ];
      for (const body of cases) {
        const res = await as(userId).put('/v1/mandir/deities', body).expect(400);
        expect(res.body.error.code).toBe('VALIDATION_FAILED');
      }
      const unknown = await as(userId).put('/v1/mandir/deities', { items: [{ deityId: randomUUID(), position: 0 }] }).expect(404);
      expect(unknown.body.error.code).toBe('DEITY_NOT_AVAILABLE');
      await as(userId).put('/v1/mandir/deities/not-a-uuid/image', { imageId: null }).expect(400);
    });
  });
});
