import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../core/prisma/prisma.module.js';
import { type StreakSummary, streakSummary } from './streak-summary.js';

/** Darshan-day streaks and badges, computed in the user's timezone. Updates + badges arrive with T7. */
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
}
