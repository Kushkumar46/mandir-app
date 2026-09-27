import { HttpStatus, Injectable } from '@nestjs/common';
import {
  type DeityListItem,
  ErrorCode,
  type HomeDeity,
  MANDIR_REMOTE_CONFIG_DEFAULTS,
  MandirFlag,
  type MandirHome,
  type MandirTheme,
  type SetDeityImageResponse,
  type SetMandirDeitiesRequest,
  type SetMandirDeitiesResponse,
  type TodayOfferings,
} from '@mandir/shared-types';
import { z } from 'zod';

import type { AuthUser } from '../../core/auth/auth.decorators.js';
import { AppException } from '../../core/errors/app.exception.js';
import { FeatureFlagService } from '../../core/feature-flags/feature-flag.service.js';
import type { FlagContext } from '../../core/feature-flags/flag-evaluator.js';
import { PrismaService } from '../../core/prisma/prisma.module.js';
import { StorageService } from '../../core/storage/storage.service.js';
import { localDateIn, weekdayOf } from '../../core/time/local-date.js';
import type { Deity } from '../../generated/prisma/client.js';
import { CoinsService } from '../coins/coins.service.js';
import { ImagesService } from '../images/images.service.js';
import { StreaksService } from '../streaks/streaks.service.js';
import { pickDefaultDeity } from './default-deity.js';
import { tithiText } from './panchang.js';

const DEFAULT_THEME_KEY = 'default';

const freeOfferingsSchema = z
  .number()
  .int()
  .min(0)
  .catch(MANDIR_REMOTE_CONFIG_DEFAULTS.freeOfferingsPerDeityPerDay);

/** One deity in the user's mandir, in display order. */
interface MandirEntry {
  deity: Deity;
  position: number;
  isPinned: boolean;
  selectedImageId: string | null;
}

/** Mandir home, user deity list (T4), offerings (T6) and rituals (T7). */
@Injectable()
export class MandirService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly flags: FeatureFlagService,
    private readonly images: ImagesService,
    private readonly coins: CoinsService,
    private readonly streaks: StreaksService,
  ) {}

  /** `GET /v1/mandir/home` — everything VM-01 needs in one call. */
  async home(user: AuthUser, flagCtx: FlagContext): Promise<MandirHome> {
    const now = new Date();
    const localDate = localDateIn(user.timezone, now);
    const weekday = weekdayOf(localDate);

    const [entries, config] = await Promise.all([this.mandirEntries(user.id), this.flags.getAppConfig(flagCtx)]);
    const isOn = (key: MandirFlag) => config.flags[key]?.enabled === true;
    const deityIds = entries.map((e) => e.deity.id);

    const [images, theme, specials, aartis, todayOfferings, balance, streak] = await Promise.all([
      this.images.resolveForDeities(user.id, entries.map(toImageRequest)),
      this.activeTheme(now, isOn(MandirFlag.FESTIVAL_THEMES)),
      isOn(MandirFlag.OFFERINGS)
        ? this.specialOfferings(deityIds, isOn(MandirFlag.PREMIUM_OFFERINGS))
        : new Map<string, HomeDeity['specialOffering']>(),
      this.defaultAartiIds(deityIds),
      this.todayOfferings(user.id, localDate, deityIds),
      this.coins.getBalance(user.id),
      this.streaks.summary(user.id, localDate),
    ]);

    return {
      today: { localDate, weekday, tithiText: tithiText(localDate, user.timezone, user.language) },
      theme: theme?.view ?? null,
      defaultDeityId: pickDefaultDeity(
        entries.map((e) => ({ id: e.deity.id, weekday: e.deity.weekday, position: e.position, isPinned: e.isPinned })),
        weekday,
        theme?.overridesDeityIds ?? [],
      ),
      deities: entries.map((e) => ({
        id: e.deity.id,
        slug: e.deity.slug,
        nameHi: e.deity.nameHi,
        nameEn: e.deity.nameEn,
        position: e.position,
        isPinned: e.isPinned,
        image: images.get(e.deity.id) ?? null,
        specialOffering: specials.get(e.deity.id) ?? null,
        defaultAartiId: aartis.get(e.deity.id) ?? null,
      })),
      todayOfferings,
      coins: { balance },
      streak,
      limits: { freeOfferingsPerDeityPerDay: freeOfferingsSchema.parse(config.remoteConfig.freeOfferingsPerDeityPerDay) },
    };
  }

  /** `GET /v1/deities` — all active deities (Sangrah), with the image this user would see. */
  async listDeities(userId: string): Promise<DeityListItem[]> {
    const [deities, entries] = await Promise.all([
      this.prisma.deity.findMany({ where: { isActive: true }, orderBy: [{ sortOrder: 'asc' }, { nameEn: 'asc' }] }),
      this.mandirEntries(userId),
    ]);
    const selected = new Map(entries.map((e) => [e.deity.id, e.selectedImageId]));
    const images = await this.images.resolveForDeities(
      userId,
      deities.map((d) => ({ deityId: d.id, selectedImageId: selected.get(d.id) ?? null, defaultImageId: d.defaultImageId })),
    );
    return deities.map((d) => ({
      id: d.id,
      slug: d.slug,
      nameHi: d.nameHi,
      nameEn: d.nameEn,
      weekday: d.weekday,
      image: images.get(d.id) ?? null,
      inMandir: selected.has(d.id),
    }));
  }

  /** `PUT /v1/mandir/deities` — replace the list; image selections of kept deities survive. */
  async setDeities(userId: string, { items }: SetMandirDeitiesRequest): Promise<SetMandirDeitiesResponse> {
    const ids = items.map((i) => i.deityId);
    const active = await this.prisma.deity.findMany({ where: { id: { in: ids }, isActive: true }, select: { id: true } });
    const activeIds = new Set(active.map((d) => d.id));
    const missing = ids.filter((id) => !activeIds.has(id));
    if (missing.length) throw deityNotAvailable({ deityIds: missing });

    await this.prisma.$transaction([
      this.prisma.userDeity.deleteMany({ where: { userId, deityId: { notIn: ids } } }),
      ...items.map((i) =>
        this.prisma.userDeity.upsert({
          where: { userId_deityId: { userId, deityId: i.deityId } },
          create: { userId, deityId: i.deityId, position: i.position, isPinned: i.isPinned },
          update: { position: i.position, isPinned: i.isPinned },
        }),
      ),
    ]);

    const sorted = [...items].sort((a, b) => a.position - b.position);
    return { items: sorted.map(({ deityId, position, isPinned }) => ({ deityId, position, isPinned })) };
  }

  /** `PUT /v1/mandir/deities/:deityId/image` — `imageId: null` resets to the default resolution. */
  async setDeityImage(userId: string, deityId: string, imageId: string | null): Promise<SetDeityImageResponse> {
    const deity = await this.prisma.deity.findUnique({ where: { id: deityId } });
    if (!deity?.isActive) throw deityNotAvailable({ deityId });
    if (imageId) await this.images.assertUsable(userId, deityId, imageId);

    await this.prisma.$transaction(async (tx) => {
      // Users still on the implicit default list get it saved first, so selecting an image
      // doesn't shrink their mandir to one deity.
      const saved = await tx.userDeity.count({ where: { userId, deity: { isActive: true } } });
      if (saved === 0) {
        const defaults = await this.defaultDeities(tx);
        await tx.userDeity.createMany({
          data: defaults.map((d, position) => ({ userId, deityId: d.id, position })),
          skipDuplicates: true,
        });
      }
      const updated = await tx.userDeity.updateMany({ where: { userId, deityId }, data: { selectedImageId: imageId } });
      if (updated.count === 0) {
        throw new AppException(ErrorCode.DEITY_NOT_IN_MANDIR, 'Deity is not in your mandir', HttpStatus.CONFLICT, {
          deityId,
        });
      }
    });

    const images = await this.images.resolveForDeities(userId, [
      { deityId, selectedImageId: imageId, defaultImageId: deity.defaultImageId },
    ]);
    return { deityId, image: images.get(deityId) ?? null };
  }

  /** Today's offerings per deity (every requested deity gets an entry). Shared with T6. */
  async todayOfferings(userId: string, localDate: string, deityIds: string[]): Promise<Record<string, TodayOfferings>> {
    const result: Record<string, TodayOfferings> = Object.fromEntries(
      deityIds.map((id) => [id, { flowers: 0, mala: false, diya: false, bhog: false }]),
    );
    if (!deityIds.length) return result;
    const logs = await this.prisma.ritualLog.findMany({
      where: { userId, localDate, action: 'OFFERING', deityId: { in: deityIds } },
      select: { deityId: true, offeringItem: { select: { kind: true } } },
    });
    for (const log of logs) {
      const t = result[log.deityId];
      switch (log.offeringItem?.kind) {
        case 'FLOWER':
          if (t) t.flowers += 1;
          break;
        case 'MALA':
          if (t) t.mala = true;
          break;
        case 'DIYA':
          if (t) t.diya = true;
          break;
        case 'BHOG':
          if (t) t.bhog = true;
          break;
      }
    }
    return result;
  }

  /** The user's saved deity list, or — until they save one — all active deities by sort order. */
  private async mandirEntries(userId: string): Promise<MandirEntry[]> {
    const rows = await this.prisma.userDeity.findMany({
      where: { userId, deity: { isActive: true } },
      include: { deity: true },
      orderBy: { position: 'asc' },
    });
    if (rows.length) return rows;
    const defaults = await this.defaultDeities(this.prisma);
    return defaults.map((deity, position) => ({ deity, position, isPinned: false, selectedImageId: null }));
  }

  private defaultDeities(db: Pick<PrismaService, 'deity'>): Promise<Deity[]> {
    return db.deity.findMany({ where: { isActive: true }, orderBy: [{ sortOrder: 'asc' }, { nameEn: 'asc' }] });
  }

  /**
   * Default theme, or — with `mandir.festival_themes` on — the running festival theme. A festival
   * theme's `deityIds` also override the default deity of the day (§6.1).
   */
  private async activeTheme(now: Date, festivalsOn: boolean) {
    const festival = festivalsOn
      ? await this.prisma.theme.findFirst({
          where: {
            isActive: true,
            key: { not: DEFAULT_THEME_KEY },
            AND: [
              { OR: [{ startsAt: null }, { startsAt: { lte: now } }] },
              { OR: [{ endsAt: null }, { endsAt: { gt: now } }] },
            ],
          },
          orderBy: { startsAt: { sort: 'desc', nulls: 'last' } },
        })
      : null;
    const theme = festival ?? (await this.prisma.theme.findUnique({ where: { key: DEFAULT_THEME_KEY } }));
    if (!theme) return null;
    const view: MandirTheme = {
      key: theme.key,
      frameUrl: this.storage.publicUrl(theme.frameKey),
      colors: (theme.colors ?? {}) as Record<string, unknown>,
      deityIds: theme.deityIds,
    };
    return { view, overridesDeityIds: festival ? festival.deityIds : [] };
  }

  /** First active SPECIAL item linked to each deity; paid ones only with `mandir.premium_offerings`. */
  private async specialOfferings(deityIds: string[], premiumOn: boolean) {
    const result = new Map<string, HomeDeity['specialOffering']>();
    if (!deityIds.length) return result;
    const items = await this.prisma.offeringItem.findMany({
      where: {
        kind: 'SPECIAL',
        isActive: true,
        ...(premiumOn ? {} : { coinCost: 0 }),
        deities: { some: { deityId: { in: deityIds } } },
      },
      include: { deities: { select: { deityId: true } } },
      orderBy: [{ sortOrder: 'asc' }, { nameEn: 'asc' }],
    });
    for (const item of items) {
      for (const { deityId } of item.deities) {
        if (result.has(deityId) || !deityIds.includes(deityId)) continue;
        result.set(deityId, {
          itemId: item.id,
          nameHi: item.nameHi,
          nameEn: item.nameEn,
          iconUrl: this.storage.publicUrl(item.iconUrl),
          coinCost: item.coinCost,
        });
      }
    }
    return result;
  }

  /** Default aarti per deity: the active one flagged default, else the newest active version. */
  private async defaultAartiIds(deityIds: string[]): Promise<Map<string, string>> {
    const result = new Map<string, string>();
    if (!deityIds.length) return result;
    const aartis = await this.prisma.aarti.findMany({
      where: { deityId: { in: deityIds }, isActive: true },
      select: { id: true, deityId: true },
      orderBy: [{ isDefault: 'desc' }, { version: 'desc' }],
    });
    for (const a of aartis) if (!result.has(a.deityId)) result.set(a.deityId, a.id);
    return result;
  }
}

function toImageRequest(e: MandirEntry) {
  return { deityId: e.deity.id, selectedImageId: e.selectedImageId, defaultImageId: e.deity.defaultImageId };
}

function deityNotAvailable(details: Record<string, unknown>) {
  return new AppException(ErrorCode.DEITY_NOT_AVAILABLE, 'Deity not available', HttpStatus.NOT_FOUND, details);
}
