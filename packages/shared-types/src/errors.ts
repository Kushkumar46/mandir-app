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
  /** Route is registered but its build task has not been implemented yet. */
  NOT_IMPLEMENTED: 'NOT_IMPLEMENTED',

  // Foundation
  FEATURE_DISABLED: 'FEATURE_DISABLED',
  IDEMPOTENCY_KEY_REQUIRED: 'IDEMPOTENCY_KEY_REQUIRED',
  IDEMPOTENCY_KEY_INVALID: 'IDEMPOTENCY_KEY_INVALID',
  IDEMPOTENCY_IN_PROGRESS: 'IDEMPOTENCY_IN_PROGRESS',
  APP_UPDATE_REQUIRED: 'APP_UPDATE_REQUIRED',

  // Virtual Mandir
  /** Deity unknown or inactive. */
  DEITY_NOT_AVAILABLE: 'DEITY_NOT_AVAILABLE',
  /** Deity is not in the user's mandir list. */
  DEITY_NOT_IN_MANDIR: 'DEITY_NOT_IN_MANDIR',
  /** Image unknown, of another deity, or not visible to the user (§6.2). */
  IMAGE_NOT_AVAILABLE: 'IMAGE_NOT_AVAILABLE',

  // Coins
  /** 402 — balance too low; `details: { required, balance }`. */
  COINS_INSUFFICIENT: 'COINS_INSUFFICIENT',
} as const;

export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];
