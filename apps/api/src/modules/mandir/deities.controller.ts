import { Controller, Get } from '@nestjs/common';
import type { DeityListItem } from '@mandir/shared-types';

import { type AuthUser, CurrentUser } from '../../core/auth/auth.decorators.js';
import { AppException } from '../../core/errors/app.exception.js';
import { MandirService } from './mandir.service.js';

@Controller('deities')
export class DeitiesController {
  constructor(private readonly mandir: MandirService) {}

  @Get()
  list(@CurrentUser() user: AuthUser): Promise<DeityListItem[]> {
    return this.mandir.listDeities(user.id);
  }

  @Get(':deityId/offerings')
  offerings() {
    throw AppException.notImplemented('T6');
  }

  @Get(':deityId/aartis')
  aartis() {
    throw AppException.notImplemented('T7');
  }
}
