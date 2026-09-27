import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../core/prisma/prisma.module.js';
import { lockUser } from '../../core/prisma/user-lock.js';
import type { Prisma } from '../../generated/prisma/client.js';
import { nextStreak, type StreakSummary, streakSummary } from './streak-summary.js';

/** Darshan-day streaks and badges, computed in the user's timezone. Badges arrive with T7. */
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

  /** Counts `localDate` as a darshan day (§6.3) inside the caller's transaction. */
  async recordDarshanDay(tx: Prisma.TransactionClient, userId: string, localDate: string): Promise<StreakSummary> {
    await lockUser(tx, userId);
    const row = await tx.userStreak.findUnique({
      where: { userId },
      select: { current: true, longest: true, lastDate: true },
    });
    const next = nextStreak(row, localDate);
    if (next !== row) {
      await tx.userStreak.upsert({ where: { userId }, create: { userId, ...next }, update: next });
    }
    return streakSummary(next, localDate);
  }
}
