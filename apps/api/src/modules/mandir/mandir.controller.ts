import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Put, Req } from '@nestjs/common';
import {
  type AartiCompleteRequest,
  aartiCompleteRequestSchema,
  type AartiCompleteResponse,
  type DarshanPingRequest,
  darshanPingRequestSchema,
  type DarshanPingResponse,
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
import { flagContextFromRequest } from '../../core/feature-flags/flag-context.js';
import { RequireFlag } from '../../core/feature-flags/require-flag.guard.js';
import { Idempotent } from '../../core/idempotency/idempotency.interceptor.js';
import { ZodValidationPipe } from '../../core/validation/zod-validation.pipe.js';
import { UserThrottle } from '../../core/throttle/user-throttle.guard.js';
import { MandirService } from './mandir.service.js';
import { RitualsService } from './rituals.service.js';

/** §6.5 technical throttle on `POST /mandir/offerings`, per user. */
export const OFFERINGS_PER_MINUTE = 60;
/** Per-user throttle on `POST /mandir/rituals/aarti-complete` (§7 "T7 contract notes"). */
export const AARTI_COMPLETIONS_PER_MINUTE = 20;

// docs/modules/01-virtual-mandir.md §7 "Mandir".
@Controller('mandir')
export class MandirController {
  constructor(
    private readonly mandir: MandirService,
    private readonly rituals: RitualsService,
  ) {}

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

  // Idempotent because it pays rewards; a retried completion must not log (or pay) twice.
  @Post('rituals/aarti-complete')
  @HttpCode(HttpStatus.OK)
  @UserThrottle(AARTI_COMPLETIONS_PER_MINUTE)
  @Idempotent()
  aartiComplete(
    @CurrentUser() user: AuthUser,
    @Req() req: Request & { user?: AuthUser },
    @Body(new ZodValidationPipe(aartiCompleteRequestSchema)) body: AartiCompleteRequest,
  ): Promise<AartiCompleteResponse> {
    return this.rituals.aartiComplete(user, body, flagContextFromRequest(req));
  }

  // A repeat is a no-op for the day (one DARSHAN log per local day), so no Idempotency-Key.
  @Post('rituals/darshan')
  @HttpCode(HttpStatus.OK)
  darshan(
    @CurrentUser() user: AuthUser,
    @Req() req: Request & { user?: AuthUser },
    @Body(new ZodValidationPipe(darshanPingRequestSchema)) body: DarshanPingRequest,
  ): Promise<DarshanPingResponse> {
    return this.rituals.darshanPing(user, body, flagContextFromRequest(req));
  }
}
