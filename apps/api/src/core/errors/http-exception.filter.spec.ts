import { HttpStatus, NotFoundException } from '@nestjs/common';
import { ThrottlerException } from '@nestjs/throttler';
import { ErrorCode } from '@mandir/shared-types';

import { AppException } from './app.exception.js';
import { HttpExceptionFilter } from './http-exception.filter.js';

describe('HttpExceptionFilter', () => {
  const filter = new HttpExceptionFilter();

  it('passes AppException code, message and details through', () => {
    const { status, body } = filter.toErrorBody(
      new AppException(ErrorCode.FEATURE_DISABLED, 'off', HttpStatus.FORBIDDEN, { flag: 'x.y' }),
    );
    expect(status).toBe(403);
    expect(body).toEqual({
      error: { code: 'FEATURE_DISABLED', message: 'off', details: { flag: 'x.y' } },
    });
  });

  it('maps Nest HTTP exceptions to error codes', () => {
    expect(filter.toErrorBody(new NotFoundException()).body.error.code).toBe('NOT_FOUND');
    const throttled = filter.toErrorBody(new ThrottlerException());
    expect(throttled.status).toBe(429);
    expect(throttled.body.error.code).toBe('RATE_LIMITED');
  });

  it('hides details of unknown errors', () => {
    const { status, body } = filter.toErrorBody(new Error('db password is hunter2'));
    expect(status).toBe(500);
    expect(body.error).toEqual({ code: 'INTERNAL', message: 'Internal server error', details: {} });
  });
});
