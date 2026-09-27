import { HttpException, HttpStatus } from '@nestjs/common';
import { ErrorCode } from '@mandir/shared-types';

/** Throw this from services/controllers; the global filter turns it into the error envelope. */
export class AppException extends HttpException {
  constructor(
    readonly code: ErrorCode,
    message: string,
    status: HttpStatus = HttpStatus.BAD_REQUEST,
    readonly details: Record<string, unknown> = {},
  ) {
    super({ code, message, details }, status);
  }

  static notFound(what: string, details: Record<string, unknown> = {}) {
    return new AppException(ErrorCode.NOT_FOUND, `${what} not found`, HttpStatus.NOT_FOUND, details);
  }

  static forbidden(message = 'Forbidden') {
    return new AppException(ErrorCode.FORBIDDEN, message, HttpStatus.FORBIDDEN);
  }

  static unauthenticated(message = 'Authentication required') {
    return new AppException(ErrorCode.UNAUTHENTICATED, message, HttpStatus.UNAUTHORIZED);
  }
}
