import {
  type CanActivate,
  type ExecutionContext,
  HttpStatus,
  Injectable,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ErrorCode } from '@mandir/shared-types';
import type { Request } from 'express';

import type { AuthUser } from '../auth/auth.decorators.js';
import { AppException } from '../errors/app.exception.js';
import { flagContextFromRequest } from './flag-context.js';
import { FeatureFlagService } from './feature-flag.service.js';

const REQUIRED_FLAGS = 'flags:required';

/**
 * Route/controller is only reachable when every listed flag is on for the caller.
 * Example: `@RequireFlag('mandir.enabled', 'mandir.community_upload')`
 */
export const RequireFlag = (...keys: string[]) => SetMetadata(REQUIRED_FLAGS, keys);

/** Global guard; registered after AuthGuard so `request.user` is available for rollout. */
@Injectable()
export class RequireFlagGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly flags: FeatureFlagService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const keys = [
      ...(this.reflector.get<string[] | undefined>(REQUIRED_FLAGS, ctx.getClass()) ?? []),
      ...(this.reflector.get<string[] | undefined>(REQUIRED_FLAGS, ctx.getHandler()) ?? []),
    ];
    if (keys.length === 0) return true;

    const flagCtx = flagContextFromRequest(ctx.switchToHttp().getRequest<Request & { user?: AuthUser }>());
    for (const key of keys) {
      if (!(await this.flags.isEnabled(key, flagCtx))) {
        throw new AppException(ErrorCode.FEATURE_DISABLED, 'This feature is not available', HttpStatus.FORBIDDEN, {
          flag: key,
        });
      }
    }
    return true;
  }
}
