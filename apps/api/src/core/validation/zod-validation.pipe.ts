import { HttpStatus, Injectable, type PipeTransform } from '@nestjs/common';
import { ErrorCode } from '@mandir/shared-types';
import type { z } from 'zod';

import { AppException } from '../errors/app.exception.js';

/**
 * Validates a body/query/param against a zod schema from `@mandir/shared-types`.
 * Usage: `@Body(new ZodValidationPipe(createThingSchema)) body: CreateThing`
 */
@Injectable()
export class ZodValidationPipe<T extends z.ZodType> implements PipeTransform<unknown, z.infer<T>> {
  constructor(private readonly schema: T) {}

  transform(value: unknown): z.infer<T> {
    const result = this.schema.safeParse(value);
    if (!result.success) {
      throw new AppException(ErrorCode.VALIDATION_FAILED, 'Invalid request', HttpStatus.BAD_REQUEST, {
        issues: result.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
      });
    }
    return result.data;
  }
}
