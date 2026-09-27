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

  /** For scaffolded routes; `task` is the build task that implements it, e.g. "T4". */
  static notImplemented(task: string) {
    return new AppException(ErrorCode.NOT_IMPLEMENTED, `Not implemented yet (${task})`, HttpStatus.NOT_IMPLEMENTED, {
      task,
    });
  }

  static unauthenticated(message = 'Authentication required') {
    return new AppException(ErrorCode.UNAUTHENTICATED, message, HttpStatus.UNAUTHORIZED);
  }
}
