import { Controller, Get, Query } from '@nestjs/common';
import { type StreakDetails, type StreakQuery, streakQuerySchema } from '@mandir/shared-types';

import { type AuthUser, CurrentUser } from '../../core/auth/auth.decorators.js';
import { localDateIn } from '../../core/time/local-date.js';
import { ZodValidationPipe } from '../../core/validation/zod-validation.pipe.js';
import { StreaksService } from './streaks.service.js';

@Controller('me')
export class StreaksController {
  constructor(private readonly streaks: StreaksService) {}

  /** Streak + badges + month calendar (VM-13). `month` defaults to the user's current local month. */
  @Get('streak')
  streak(
    @CurrentUser() user: AuthUser,
    @Query(new ZodValidationPipe(streakQuerySchema)) query: StreakQuery,
  ): Promise<StreakDetails> {
    const localDate = localDateIn(user.timezone);
    return this.streaks.details(user.id, localDate, query.month ?? localDate.slice(0, 7));
  }
}
