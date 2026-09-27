import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Put, Req } from '@nestjs/common';
import {
  type MakeOfferingRequest,
  makeOfferingRequestSchema,
  type MakeOfferingResponse,
  MandirFlag,
  type MandirHome,
  type SetDeityImageRequest,
  setDeityImageRequestSchema,
  type SetDeityImageResponse,
  type SetMandirDeitiesRequest,
  setMandirDeitiesRequestSchema,
  type SetMandirDeitiesResponse,
  uuidSchema,
} from '@mandir/shared-types';
import type { Request } from 'express';

import { type AuthUser, CurrentUser } from '../../core/auth/auth.decorators.js';
import { AppException } from '../../core/errors/app.exception.js';
import { flagContextFromRequest } from '../../core/feature-flags/flag-context.js';
import { RequireFlag } from '../../core/feature-flags/require-flag.guard.js';
import { Idempotent } from '../../core/idempotency/idempotency.interceptor.js';
import { ZodValidationPipe } from '../../core/validation/zod-validation.pipe.js';
import { UserThrottle } from '../../core/throttle/user-throttle.guard.js';
import { MandirService } from './mandir.service.js';

/** §6.5 technical throttle on `POST /mandir/offerings`, per user. */
export const OFFERINGS_PER_MINUTE = 60;

// docs/modules/01-virtual-mandir.md §7 "Mandir"; remaining stubs are replaced by their build tasks.
@Controller('mandir')
export class MandirController {
  constructor(private readonly mandir: MandirService) {}

  @Get('home')
  @RequireFlag(MandirFlag.ENABLED)
  home(@CurrentUser() user: AuthUser, @Req() req: Request & { user?: AuthUser }): Promise<MandirHome> {
    return this.mandir.home(user, flagContextFromRequest(req));
  }

  @Put('deities')
  setDeities(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(setMandirDeitiesRequestSchema)) body: SetMandirDeitiesRequest,
  ): Promise<SetMandirDeitiesResponse> {
    return this.mandir.setDeities(user.id, body);
  }

  @Put('deities/:deityId/image')
  setDeityImage(
    @CurrentUser() user: AuthUser,
    @Param('deityId', new ZodValidationPipe(uuidSchema)) deityId: string,
    @Body(new ZodValidationPipe(setDeityImageRequestSchema)) body: SetDeityImageRequest,
  ): Promise<SetDeityImageResponse> {
    return this.mandir.setDeityImage(user.id, deityId, body.imageId);
  }

  // Paid items additionally need `mandir.premium_offerings`, checked in the service. Free offerings
  // are unlimited (§6.5); only this technical throttle applies.
  @Post('offerings')
  @HttpCode(HttpStatus.OK)
  @RequireFlag(MandirFlag.OFFERINGS)
  @UserThrottle(OFFERINGS_PER_MINUTE)
  @Idempotent()
  offer(
    @CurrentUser() user: AuthUser,
    @Req() req: Request & { user?: AuthUser },
    @Body(new ZodValidationPipe(makeOfferingRequestSchema)) body: MakeOfferingRequest,
  ): Promise<MakeOfferingResponse> {
    return this.mandir.makeOffering(user, body, flagContextFromRequest(req));
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
