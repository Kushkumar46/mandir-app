import { createHash } from 'node:crypto';

import {
  applyDecorators,
  type CallHandler,
  type ExecutionContext,
  HttpStatus,
  Inject,
  Injectable,
  type NestInterceptor,
  UseInterceptors,
} from '@nestjs/common';
import { ErrorCode, Header } from '@mandir/shared-types';
import type { Request, Response } from 'express';
import { catchError, concatMap, from, map, type Observable, of, switchMap, throwError } from 'rxjs';

import type { AuthUser } from '../auth/auth.decorators.js';
import { AppException } from '../errors/app.exception.js';
import { IDEMPOTENCY_STORE, type IdempotencyStore } from './idempotency.store.js';

export const IDEMPOTENCY_TTL_SECONDS = 24 * 60 * 60;
/** How long a request may hold the key before another attempt is allowed. */
const IN_PROGRESS_TTL_SECONDS = 60;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Requires `Idempotency-Key: <uuid>`. The first response is stored for 24h; a repeat with the
 * same key (same user, method, path) replays it. A repeat with a different body is rejected.
 */
@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
  constructor(@Inject(IDEMPOTENCY_STORE) private readonly store: IdempotencyStore) {}

  intercept(ctx: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = ctx.switchToHttp();
    const req = http.getRequest<Request & { user?: AuthUser }>();
    const res = http.getResponse<Response>();

    const idemKey = req.header(Header.IDEMPOTENCY_KEY);
    if (!idemKey) {
      throw new AppException(
        ErrorCode.IDEMPOTENCY_KEY_REQUIRED,
        'Idempotency-Key header is required',
        HttpStatus.BAD_REQUEST,
      );
    }
    if (!UUID.test(idemKey)) {
      throw new AppException(ErrorCode.IDEMPOTENCY_KEY_INVALID, 'Idempotency-Key must be a UUID');
    }

    const storeKey = `idem:${req.user?.id ?? 'anon'}:${req.method}:${req.route?.path ?? req.path}:${idemKey}`;
    const requestHash = createHash('sha256').update(JSON.stringify(req.body ?? null)).digest('hex');

    return from(this.store.claim(storeKey, { status: 'in_progress', requestHash }, IN_PROGRESS_TTL_SECONDS)).pipe(
      switchMap((claimed) => (claimed ? this.run(next, storeKey, requestHash) : this.replay(storeKey, requestHash, res))),
    );
  }

  private run(next: CallHandler, storeKey: string, requestHash: string): Observable<unknown> {
    return next.handle().pipe(
      // Save before emitting so an immediate retry replays instead of hitting "in progress".
      concatMap((body) =>
        from(this.store.save(storeKey, { status: 'done', requestHash, body }, IDEMPOTENCY_TTL_SECONDS)).pipe(
          map(() => body),
        ),
      ),
      // Failed requests may be retried with the same key.
      catchError((err: unknown) => from(this.store.release(storeKey)).pipe(concatMap(() => throwError(() => err)))),
    );
  }

  private replay(storeKey: string, requestHash: string, res: Response): Observable<unknown> {
    return from(this.store.get(storeKey)).pipe(
      switchMap((record) => {
        if (!record || record.status === 'in_progress') {
          throw new AppException(
            ErrorCode.IDEMPOTENCY_IN_PROGRESS,
            'A request with this Idempotency-Key is still being processed',
            HttpStatus.CONFLICT,
          );
        }
        if (record.requestHash !== requestHash) {
          throw new AppException(
            ErrorCode.IDEMPOTENCY_KEY_INVALID,
            'Idempotency-Key was already used with a different request body',
            HttpStatus.UNPROCESSABLE_ENTITY,
          );
        }
        // Status code is re-applied by Nest from the route (@HttpCode / method default).
        res.setHeader('Idempotent-Replayed', 'true');
        return of(record.body);
      }),
    );
  }
}

/** Put on any route that spends coins/money or creates orders. */
export const Idempotent = () => applyDecorators(UseInterceptors(IdempotencyInterceptor));
