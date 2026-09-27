import {
  type CallHandler,
  type ExecutionContext,
  Injectable,
  type NestInterceptor,
  StreamableFile,
} from '@nestjs/common';
import type { PaginatedResponse } from '@mandir/shared-types';
import { map, type Observable } from 'rxjs';

const PAGINATED = Symbol('paginated');

/** Return this from a controller for list endpoints: `{ data: [...], nextCursor }`. */
export function paginated<T>(items: T[], nextCursor: string | null): PaginatedResponse<T> {
  return Object.defineProperty({ data: items, nextCursor }, PAGINATED, { value: true });
}

function isPaginated(value: unknown): boolean {
  return typeof value === 'object' && value !== null && PAGINATED in value;
}

/** Wraps every successful response as `{ data: <payload> }` (docs/01-architecture.md §3). */
@Injectable()
export class ResponseEnvelopeInterceptor implements NestInterceptor {
  intercept(_ctx: ExecutionContext, next: CallHandler): Observable<unknown> {
    return next.handle().pipe(
      map((value: unknown) => {
        if (value instanceof StreamableFile || isPaginated(value)) return value;
        return { data: value ?? null };
      }),
    );
  }
}
