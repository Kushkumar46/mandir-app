import {
  applyDecorators,
  type CanActivate,
  type ExecutionContext,
  Inject,
  Injectable,
  SetMetadata,
  UseGuards,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ThrottlerException, ThrottlerStorage } from '@nestjs/throttler';
import type { Request, Response } from 'express';

import type { AuthUser } from '../auth/auth.decorators.js';

const USER_THROTTLE = 'throttle:user';
const THROTTLER_NAME = 'user';

interface UserThrottleOptions {
  limit: number;
  ttlMs: number;
}

/**
 * Per-user rate limit for one route, e.g. `@UserThrottle(60)` = 60 requests/minute per user. Runs as
 * a route guard, i.e. after the global guards (so the user is authenticated) and before interceptors
 * and the handler (so a throttled request writes nothing). The global per-IP `ThrottlerGuard` still
 * applies. Counts live in the throttler's storage. Over the limit → 429 `RATE_LIMITED` + `Retry-After`,
 * and the user stays blocked for `ttlMs`.
 */
export const UserThrottle = (limit: number, ttlMs = 60_000) =>
  applyDecorators(SetMetadata(USER_THROTTLE, { limit, ttlMs } satisfies UserThrottleOptions), UseGuards(UserThrottleGuard));

@Injectable()
export class UserThrottleGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @Inject(ThrottlerStorage) private readonly storage: ThrottlerStorage,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const options = this.reflector.get<UserThrottleOptions | undefined>(USER_THROTTLE, ctx.getHandler());
    const http = ctx.switchToHttp();
    const user = http.getRequest<Request & { user?: AuthUser }>().user;
    if (!options || !user) return true;

    const key = `user-throttle:${ctx.getClass().name}.${ctx.getHandler().name}:${user.id}`;
    const { isBlocked, timeToBlockExpire } = await this.storage.increment(
      key,
      options.ttlMs,
      options.limit,
      options.ttlMs,
      THROTTLER_NAME,
    );
    if (isBlocked) {
      http.getResponse<Response>().setHeader('Retry-After', String(Math.max(1, timeToBlockExpire)));
      throw new ThrottlerException();
    }
    return true;
  }
}
