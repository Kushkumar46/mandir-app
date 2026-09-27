import { Controller, Get, Post, Put } from '@nestjs/common';
import { MandirFlag } from '@mandir/shared-types';

import { AppException } from '../../core/errors/app.exception.js';
import { RequireFlag } from '../../core/feature-flags/require-flag.guard.js';
import { Idempotent } from '../../core/idempotency/idempotency.interceptor.js';

// Route stubs from docs/modules/01-virtual-mandir.md §7; each build task replaces its stubs.
@Controller('mandir')
export class MandirController {
  @Get('home')
  @RequireFlag(MandirFlag.ENABLED)
  home() {
    throw AppException.notImplemented('T4');
  }

  @Put('deities')
  setDeities() {
    throw AppException.notImplemented('T4');
  }

  @Put('deities/:deityId/image')
  setDeityImage() {
    throw AppException.notImplemented('T4');
  }

  // Paid items additionally need `mandir.premium_offerings`, checked in the service (T6).
  @Post('offerings')
  @RequireFlag(MandirFlag.OFFERINGS)
  @Idempotent()
  offer() {
    throw AppException.notImplemented('T6');
  }

  @Post('rituals/aarti-complete')
  aartiComplete() {
    throw AppException.notImplemented('T7');
  }

  @Post('rituals/darshan')
  darshan() {
    throw AppException.notImplemented('T7');
  }
}
