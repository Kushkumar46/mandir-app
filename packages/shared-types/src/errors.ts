/**
 * Every error code the API can return in `{ error: { code } }`.
 * Modules add their own codes here (prefixed with the module name).
 */
export const ErrorCode = {
  // Generic
  VALIDATION_FAILED: 'VALIDATION_FAILED',
  NOT_FOUND: 'NOT_FOUND',
  UNAUTHENTICATED: 'UNAUTHENTICATED',
  FORBIDDEN: 'FORBIDDEN',
  RATE_LIMITED: 'RATE_LIMITED',
  CONFLICT: 'CONFLICT',
  INTERNAL: 'INTERNAL',

  // Foundation
  FEATURE_DISABLED: 'FEATURE_DISABLED',
  IDEMPOTENCY_KEY_REQUIRED: 'IDEMPOTENCY_KEY_REQUIRED',
  IDEMPOTENCY_KEY_INVALID: 'IDEMPOTENCY_KEY_INVALID',
  IDEMPOTENCY_IN_PROGRESS: 'IDEMPOTENCY_IN_PROGRESS',
  APP_UPDATE_REQUIRED: 'APP_UPDATE_REQUIRED',
} as const;

export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];
