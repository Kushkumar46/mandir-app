import { randomUUID } from 'node:crypto';

import { HttpStatus, Injectable } from '@nestjs/common';
import {
  ErrorCode,
  type HomeThali,
  type SelectThaliResponse,
  type ThaliList,
  type UnlockThaliResponse,
} from '@mandir/shared-types';

import { AppException } from '../../core/errors/app.exception.js';
import { PrismaService } from '../../core/prisma/prisma.module.js';
import { lockUser } from '../../core/prisma/user-lock.js';
import { StorageService } from '../../core/storage/storage.service.js';
import { Prisma, type ThaliDesign } from '../../generated/prisma/client.js';
import { CoinsService } from '../coins/coins.service.js';

type Db = Pick<Prisma.TransactionClient, 'thaliDesign' | 'userUnlock' | 'userMandirSettings'>;

// Lock waits under contention count against these (as in CoinsService).
const TX_OPTIONS = { maxWait: 10_000, timeout: 15_000 };
const DESIGN_ORDER = [{ sortOrder: 'asc' }, { nameEn: 'asc' }] satisfies Prisma.ThaliDesignOrderByWithRelationInput[];

/**
 * Thali designs (§6.8): bought once with coins, usable forever. Free designs (`coinCost` 0) need no
 * unlock row; the default free thali is the active free design with the lowest `sortOrder`.
 * Ownership is the generic `UserUnlock` table (`itemType THALI`). The caller checks `mandir.thali_designs`.
 */
@Injectable()
export class ThalisService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly coins: CoinsService,
  ) {}

  /** `GET /v1/mandir/thalis` — active designs with `unlocked` / `selected` for this user. */
  async list(userId: string): Promise<ThaliList> {
    const [designs, settings] = await Promise.all([
      this.prisma.thaliDesign.findMany({ where: { isActive: true }, orderBy: DESIGN_ORDER }),
      this.prisma.userMandirSettings.findUnique({ where: { userId } }),
    ]);
    const unlocked = await this.unlockedIds(
      this.prisma,
      userId,
      designs.filter((d) => d.coinCost > 0).map((d) => d.id),
    );
    const usable = (d: ThaliDesign) => d.coinCost === 0 || unlocked.has(d.id);
    // Designs are sorted, so the first free one is the default free thali.
    const selected =
      designs.find((d) => d.id === settings?.selectedThaliId && usable(d)) ?? designs.find((d) => d.coinCost === 0);

    return {
      selectedThaliId: selected?.id ?? null,
      items: designs.map((d) => ({
        id: d.id,
        nameHi: d.nameHi,
        nameEn: d.nameEn,
        imageUrl: this.storage.publicUrl(d.imageKey),
        flameStyle: d.flameStyle,
        coinCost: d.coinCost,
        unlocked: usable(d),
        selected: d.id === selected?.id,
      })),
    };
  }

  /**
   * `POST /v1/mandir/thalis/:thaliId/unlock` — one transaction under the user lock: no unlock yet →
   * debit `coinCost` (`UNLOCK`, refType "unlock", refId = unlock id) → insert `UserUnlock`. Free or
   * already unlocked → 409 `ALREADY_UNLOCKED` with no debit.
   */
  async unlock(userId: string, thaliId: string): Promise<UnlockThaliResponse> {
    const thali = await this.activeThali(thaliId);
    if (thali.coinCost === 0) throw alreadyUnlocked(thaliId);

    try {
      return await this.prisma.$transaction(async (tx) => {
        await lockUser(tx, userId);
        if ((await this.unlockedIds(tx, userId, [thaliId])).size > 0) throw alreadyUnlocked(thaliId);

        const unlockId = randomUUID();
        const { balance } = await this.coins.debit(
          userId,
          thali.coinCost,
          { reason: 'UNLOCK', refType: 'unlock', refId: unlockId },
          tx,
        );
        await tx.userUnlock.create({
          data: { id: unlockId, userId, itemType: 'THALI', itemId: thaliId, coinsSpent: thali.coinCost },
        });
        return { thaliId, coinsSpent: thali.coinCost, coinsBalance: balance };
      }, TX_OPTIONS);
    } catch (err) {
      // Last line of defence (§6.8): the unique (user, type, item) index; the debit rolled back with it.
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') throw alreadyUnlocked(thaliId);
      throw err;
    }
  }

  /** `PUT /v1/mandir/thali` — select an active design that is free or unlocked (does not unlock). */
  async select(userId: string, thaliId: string): Promise<SelectThaliResponse> {
    const thali = await this.activeThali(thaliId);
    await this.assertUsable(this.prisma, userId, thali);
    await this.prisma.userMandirSettings.upsert({
      where: { userId },
      create: { userId, selectedThaliId: thaliId },
      update: { selectedThaliId: thaliId },
    });
    return { selectedThaliId: thaliId };
  }

  /**
   * The thali the user sees: their selection if it is still active and usable, else the default free
   * thali (also when `useSelection` is false, i.e. the flag is off). Null when no free design is active.
   */
  async resolve(db: Db, userId: string, useSelection: boolean): Promise<ThaliDesign | null> {
    if (useSelection) {
      const settings = await db.userMandirSettings.findUnique({
        where: { userId },
        include: { selectedThali: true },
      });
      const selected = settings?.selectedThali;
      if (selected?.isActive && (selected.coinCost === 0 || (await this.unlockedIds(db, userId, [selected.id])).size)) {
        return selected;
      }
    }
    return db.thaliDesign.findFirst({ where: { isActive: true, coinCost: 0 }, orderBy: DESIGN_ORDER });
  }

  /**
   * Thali to record on an aarti completion: the requested one if usable (else 403 `THALI_LOCKED` /
   * 404 `THALI_NOT_AVAILABLE`), otherwise the resolved selection. With the flag off the request's
   * `thaliId` is ignored and the default free thali is recorded.
   */
  async forAarti(db: Db, userId: string, thaliId: string | undefined, flagOn: boolean): Promise<string | null> {
    if (flagOn && thaliId) {
      const thali = await db.thaliDesign.findUnique({ where: { id: thaliId } });
      if (!thali?.isActive) throw thaliNotAvailable(thaliId);
      await this.assertUsable(db, userId, thali);
      return thali.id;
    }
    return (await this.resolve(db, userId, flagOn))?.id ?? null;
  }

  homeView(thali: ThaliDesign | null): HomeThali | null {
    return thali && { id: thali.id, imageUrl: this.storage.publicUrl(thali.imageKey), flameStyle: thali.flameStyle };
  }

  private async activeThali(thaliId: string): Promise<ThaliDesign> {
    const thali = await this.prisma.thaliDesign.findUnique({ where: { id: thaliId } });
    if (!thali?.isActive) throw thaliNotAvailable(thaliId);
    return thali;
  }

  private async assertUsable(db: Db, userId: string, thali: ThaliDesign): Promise<void> {
    if (thali.coinCost === 0 || (await this.unlockedIds(db, userId, [thali.id])).size > 0) return;
    throw new AppException(ErrorCode.THALI_LOCKED, 'Thali is locked', HttpStatus.FORBIDDEN, { thaliId: thali.id });
  }

  private async unlockedIds(db: Db, userId: string, thaliIds: string[]): Promise<Set<string>> {
    if (!thaliIds.length) return new Set();
    const rows = await db.userUnlock.findMany({
      where: { userId, itemType: 'THALI', itemId: { in: thaliIds } },
      select: { itemId: true },
    });
    return new Set(rows.map((r) => r.itemId));
  }
}

function thaliNotAvailable(thaliId: string) {
  return new AppException(ErrorCode.THALI_NOT_AVAILABLE, 'Thali not available', HttpStatus.NOT_FOUND, { thaliId });
}

function alreadyUnlocked(thaliId: string) {
  return new AppException(ErrorCode.ALREADY_UNLOCKED, 'Already unlocked', HttpStatus.CONFLICT, { thaliId });
}
