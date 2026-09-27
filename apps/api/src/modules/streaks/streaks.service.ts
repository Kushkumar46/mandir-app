import { Injectable } from '@nestjs/common';
import { type BadgeKey, type StreakDetails } from '@mandir/shared-types';

import { PrismaService } from '../../core/prisma/prisma.module.js';
import { lockUser } from '../../core/prisma/user-lock.js';
import type { Prisma } from '../../generated/prisma/client.js';
import { monthRange, nextStreak, streakBadgesFor, type StreakSummary, streakSummary } from './streak-summary.js';

/** Ritual actions that make a darshan day (§6.3); BELL does not. */
const DARSHAN_DAY_ACTIONS = ['OFFERING', 'AARTI_COMPLETE', 'DARSHAN'] as const;

export interface DarshanDayResult {
  streak: StreakSummary;
  /** True when this was the first darshan of `localDate` (the streak row changed). */
  firstOfDay: boolean;
  /** Streak badges first earned now. */
  badgesEarned: BadgeKey[];
}

/** Darshan-day streaks and streak badges, computed in the user's timezone. */
@Injectable()
export class StreaksService {
  constructor(private readonly prisma: PrismaService) {}

  /** Streak as seen on the user's `localDate`. */
  async summary(userId: string, localDate: string): Promise<StreakSummary> {
    const row = await this.prisma.userStreak.findUnique({
      where: { userId },
      select: { current: true, longest: true, lastDate: true },
    });
    return streakSummary(row, localDate);
  }

  /**
   * Counts `localDate` as a darshan day (§6.3) inside the caller's transaction and awards any streak
   * badge the streak has reached but the user doesn't hold yet (so a missing one is caught up).
   */
  async recordDarshanDay(tx: Prisma.TransactionClient, userId: string, localDate: string): Promise<DarshanDayResult> {
    await lockUser(tx, userId);
    const row = await tx.userStreak.findUnique({
      where: { userId },
      select: { current: true, longest: true, lastDate: true },
    });
    const next = nextStreak(row, localDate);
    const firstOfDay = next !== row;
    if (firstOfDay) {
      await tx.userStreak.upsert({ where: { userId }, create: { userId, ...next }, update: next });
    }

    let badgesEarned: BadgeKey[] = [];
    const due = streakBadgesFor(next.current);
    if (due.length) {
      const held = await tx.userBadge.findMany({ where: { userId, badgeKey: { in: due } }, select: { badgeKey: true } });
      const heldKeys = new Set(held.map((b) => b.badgeKey));
      badgesEarned = due.filter((key) => !heldKeys.has(key));
      if (badgesEarned.length) {
        await tx.userBadge.createMany({ data: badgesEarned.map((badgeKey) => ({ userId, badgeKey })) });
      }
    }
    return { streak: streakSummary(next, localDate), firstOfDay, badgesEarned };
  }

  /** `GET /v1/me/streak` — streak, badges and the darshan days of `month` ("YYYY-MM"). */
  async details(userId: string, localDate: string, month: string): Promise<StreakDetails> {
    const { first, last } = monthRange(month);
    const [streak, badges, days] = await Promise.all([
      this.summary(userId, localDate),
      this.prisma.userBadge.findMany({ where: { userId }, orderBy: [{ earnedAt: 'asc' }, { badgeKey: 'asc' }] }),
      this.prisma.ritualLog.findMany({
        where: { userId, localDate: { gte: first, lte: last }, action: { in: [...DARSHAN_DAY_ACTIONS] } },
        distinct: ['localDate'],
        select: { localDate: true },
        orderBy: { localDate: 'asc' },
      }),
    ]);
    return {
      ...streak,
      badges: badges.map((b) => ({ key: b.badgeKey as BadgeKey, earnedAt: b.earnedAt.toISOString() })),
      calendar: { month, days: days.map((d) => d.localDate) },
    };
  }
}
