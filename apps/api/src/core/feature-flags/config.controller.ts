import { Controller, Get, Req } from '@nestjs/common';
import type { AppConfig } from '@mandir/shared-types';
import type { Request } from 'express';

import { type AuthUser, OptionalAuth } from '../auth/auth.decorators.js';
import { flagContextFromRequest } from './flag-context.js';
import { FeatureFlagService } from './feature-flag.service.js';

@Controller('config')
export class ConfigController {
  constructor(private readonly flags: FeatureFlagService) {}

  /** Flags evaluated for the caller + remote config. Works before login (anonymous). */
  @Get()
  @OptionalAuth()
  getConfig(@Req() req: Request & { user?: AuthUser }): Promise<AppConfig> {
    return this.flags.getAppConfig(flagContextFromRequest(req));
  }
}
