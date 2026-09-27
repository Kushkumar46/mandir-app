import { Controller, Get, Param, Req } from '@nestjs/common';
import { type DeityListItem, type DeityOfferings, MandirFlag, uuidSchema } from '@mandir/shared-types';
import type { Request } from 'express';

import { type AuthUser, CurrentUser } from '../../core/auth/auth.decorators.js';
import { AppException } from '../../core/errors/app.exception.js';
import { flagContextFromRequest } from '../../core/feature-flags/flag-context.js';
import { RequireFlag } from '../../core/feature-flags/require-flag.guard.js';
import { ZodValidationPipe } from '../../core/validation/zod-validation.pipe.js';
import { MandirService } from './mandir.service.js';

@Controller('deities')
export class DeitiesController {
  constructor(private readonly mandir: MandirService) {}

  @Get()
  list(@CurrentUser() user: AuthUser): Promise<DeityListItem[]> {
    return this.mandir.listDeities(user.id);
  }

  @Get(':deityId/offerings')
  @RequireFlag(MandirFlag.OFFERINGS)
  offerings(
    @Req() req: Request & { user?: AuthUser },
    @Param('deityId', new ZodValidationPipe(uuidSchema)) deityId: string,
  ): Promise<DeityOfferings> {
    return this.mandir.deityOfferings(deityId, flagContextFromRequest(req));
  }

  @Get(':deityId/aartis')
  aartis() {
    throw AppException.notImplemented('T7');
  }
}
