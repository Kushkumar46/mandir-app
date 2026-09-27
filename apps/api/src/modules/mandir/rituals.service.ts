import { HttpStatus, Injectable } from '@nestjs/common';
import {
  AARTI_MIN_CIRCLES,
  AARTI_MIN_PLAYED_RATIO,
  type AartiCompleteRequest,
  type AartiCompleteResponse,
  type BadgeKey,
  DARSHAN_PING_SECONDS_KEY,
  type DarshanPingRequest,
  type DarshanPingResponse,
  type DeityAartis,
  DEFAULT_DARSHAN_PING_SECONDS,
  ErrorCode,
  MandirFlag,
  type RemoteConfig,
  type RewardGrant,
  STREAK_BADGE_DAYS,
  streakBadgeKey,
} from '@mandir/shared-types';

import type { AuthUser } from '../../core/auth/auth.decorators.js';
import { AppException } from '../../core/errors/app.exception.js';
import { FeatureFlagService } from '../../core/feature-flags/feature-flag.service.js';
import type { FlagContext } from '../../core/feature-flags/flag-evaluator.js';
import { PrismaService } from '../../core/prisma/prisma.module.js';
import { lockUser } from '../../core/prisma/user-lock.js';
import { StorageService } from '../../core/storage/storage.service.js';
import { localDateIn } from '../../core/time/local-date.js';
import type { Prisma } from '../../generated/prisma/client.js';
import { CoinsService } from '../coins/coins.service.js';
import { RewardsService } from '../coins/rewards.service.js';
import type { StreakSummary } from '../streaks/streak-summary.js';
import { StreaksService } from '../streaks/streaks.service.js';
import { findActiveDeity } from './active-deity.js';

const FIRST_DARSHAN_REWARD = 'FIRST_DARSHAN_OF_DAY';
const AARTI_COMPLETE_REWARD = 'AARTI_COMPLETE';
// Lock waits under contention count against these (as in CoinsService).
const TX_OPTIONS = { maxWait: 10_000, timeout: 15_000 };

/** Result of the darshan-day step shared by offerings, aarti-complete and the darshan ping. */
export interface DarshanStep {
  streak: StreakSummary;
  rewards: RewardGrant[];
  badgesEarned: BadgeKey[];
  /** Balance after the last reward, or null when nothing was paid. */
  balance: number | null;
}

/** Aartis, aarti completion and darshan ping (T7), plus the darshan-day step (§6.3, §6.4). */
@Injectable()
export class RitualsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly flags: FeatureFlagService,
    private readonly coins: CoinsService,
    private readonly rewards: RewardsService,
    private readonly streaks: StreaksService,
  ) {}

  /** `GET /v1/deities/:deityId/aartis` — active aartis, default first, then newest version. */
  async deityAartis(deityId: string): Promise<DeityAartis> {
    await findActiveDeity(this.prisma, deityId);
    const aartis = await this.prisma.aarti.findMany({
      where: { deityId, isActive: true },
      orderBy: [{ isDefault: 'desc' }, { version: 'desc' }, { titleEn: 'asc' }],
    });
    return {
      deityId,
      items: aartis.map((a) => ({
        id: a.id,
        titleHi: a.titleHi,
        titleEn: a.titleEn,
        audioUrl: this.storage.publicUrl(a.audioKey),
        lyricsUrl: this.storage.publicUrl(a.lyricsKey),
        durationSec: a.durationSec,
        version: a.version,
        isDefault: a.isDefault,
      })),
    };
  }

  /**
   * `POST /v1/mandir/rituals/aarti-complete` — checks the VM-06 completion rule, logs the aarti, counts
   * the darshan day and pays AARTI_COMPLETE (2/day), all in one transaction.
   */
  async aartiComplete(user: AuthUser, body: AartiCompleteRequest, flagCtx: FlagContext): Promise<AartiCompleteResponse> {
    const [config, , aarti] = await Promise.all([
      this.flags.getAppConfig(flagCtx),
      findActiveDeity(this.prisma, body.deityId),
      this.prisma.aarti.findUnique({ where: { id: body.aartiId } }),
    ]);
    if (!aarti?.isActive || aarti.deityId !== body.deityId) {
      throw new AppException(ErrorCode.AARTI_NOT_AVAILABLE, 'Aarti not available', HttpStatus.NOT_FOUND, {
        aartiId: body.aartiId,
        deityId: body.deityId,
      });
    }
    if (body.playedRatio < AARTI_MIN_PLAYED_RATIO || body.circles < AARTI_MIN_CIRCLES) {
      throw new AppException(ErrorCode.AARTI_INCOMPLETE, 'Aarti not completed', HttpStatus.UNPROCESSABLE_ENTITY, {
        playedRatio: body.playedRatio,
        circles: body.circles,
        minPlayedRatio: AARTI_MIN_PLAYED_RATIO,
        minCircles: AARTI_MIN_CIRCLES,
      });
    }
    const rewardsOn = config.flags[MandirFlag.REWARDS]?.enabled === true;
    const localDate = localDateIn(user.timezone);

    return this.prisma.$transaction(async (tx) => {
      await lockUser(tx, user.id);
      const log = await tx.ritualLog.create({
        data: { userId: user.id, deityId: body.deityId, action: 'AARTI_COMPLETE', aartiId: aarti.id, localDate },
        select: { id: true },
      });
      const step = await this.recordDarshan(tx, user, localDate, rewardsOn);
      if (rewardsOn) {
        const reward = await this.rewards.grant(tx, user.id, AARTI_COMPLETE_REWARD, { localDate, timezone: user.timezone });
        if (reward) {
          step.rewards.push({ ruleKey: reward.ruleKey, coins: reward.coins });
          step.balance = reward.balance;
        }
      }
      return { ritualLogId: log.id, ...(await this.outcome(tx, user.id, step)) };
    }, TX_OPTIONS);
  }

  /**
   * `POST /v1/mandir/rituals/darshan` — presence ping after `darshanPingSeconds` on VM-01. Counts the
   * darshan day; writes at most one DARSHAN log per user per local day.
   */
  async darshanPing(user: AuthUser, body: DarshanPingRequest, flagCtx: FlagContext): Promise<DarshanPingResponse> {
    const [config] = await Promise.all([this.flags.getAppConfig(flagCtx), findActiveDeity(this.prisma, body.deityId)]);
    const minSeconds = darshanPingSeconds(config.remoteConfig);
    const localDate = localDateIn(user.timezone);

    if (minSeconds === null) {
      const [balance, streak] = await Promise.all([
        this.coins.getBalance(user.id),
        this.streaks.summary(user.id, localDate),
      ]);
      return { counted: false, coinsBalance: balance, streak, rewards: [], badgesEarned: [] };
    }
    if (body.seconds < minSeconds) {
      throw new AppException(ErrorCode.DARSHAN_TOO_SHORT, 'Darshan too short', HttpStatus.UNPROCESSABLE_ENTITY, {
        seconds: body.seconds,
        minSeconds,
      });
    }
    const rewardsOn = config.flags[MandirFlag.REWARDS]?.enabled === true;

    return this.prisma.$transaction(async (tx) => {
      await lockUser(tx, user.id);
      const logged = await tx.ritualLog.findFirst({
        where: { userId: user.id, localDate, action: 'DARSHAN' },
        select: { id: true },
      });
      if (!logged) {
        await tx.ritualLog.create({ data: { userId: user.id, deityId: body.deityId, action: 'DARSHAN', localDate } });
      }
      const step = await this.recordDarshan(tx, user, localDate, rewardsOn);
      return { counted: true, ...(await this.outcome(tx, user.id, step)) };
    }, TX_OPTIONS);
  }

  /**
   * The darshan-day step, inside the caller's transaction after the user lock: streak (§6.3) + streak
   * badges, then — if rewards are on — FIRST_DARSHAN_OF_DAY and, on the first darshan of the day, the
   * streak-milestone rewards for every threshold reached (once per user each, §6.4).
   */
  async recordDarshan(
    tx: Prisma.TransactionClient,
    user: AuthUser,
    localDate: string,
    rewardsOn: boolean,
  ): Promise<DarshanStep> {
    const day = await this.streaks.recordDarshanDay(tx, user.id, localDate);
    const step: DarshanStep = { streak: day.streak, rewards: [], badgesEarned: day.badgesEarned, balance: null };
    if (!rewardsOn) return step;

    const ruleKeys = [FIRST_DARSHAN_REWARD];
    if (day.firstOfDay) {
      ruleKeys.push(...STREAK_BADGE_DAYS.filter((d) => day.streak.current >= d).map(streakBadgeKey));
    }
    for (const ruleKey of ruleKeys) {
      const reward = await this.rewards.grant(tx, user.id, ruleKey, { localDate, timezone: user.timezone });
      if (reward) {
        step.rewards.push({ ruleKey: reward.ruleKey, coins: reward.coins });
        step.balance = reward.balance;
      }
    }
    return step;
  }

  private async outcome(tx: Prisma.TransactionClient, userId: string, step: DarshanStep) {
    const balance = step.balance ?? (await tx.coinWallet.findUnique({ where: { userId } }))?.balance ?? 0;
    return { coinsBalance: balance, streak: step.streak, rewards: step.rewards, badgesEarned: step.badgesEarned };
  }
}

/** Remote config `darshanPingSeconds`: missing → default; null → pings don't count. */
function darshanPingSeconds(remoteConfig: RemoteConfig): number | null {
  const value = remoteConfig[DARSHAN_PING_SECONDS_KEY];
  if (value === null) return null;
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : DEFAULT_DARSHAN_PING_SECONDS;
}
