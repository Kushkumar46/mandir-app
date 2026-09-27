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
  /** 404 — offering item unknown, inactive or not offered to this deity (§6.5). */
  ITEM_NOT_AVAILABLE: 'ITEM_NOT_AVAILABLE',
  /** 404 — aarti unknown, inactive or of another deity. */
  AARTI_NOT_AVAILABLE: 'AARTI_NOT_AVAILABLE',
  /** 422 — aarti completion rule not met; `details: { playedRatio, circles, minPlayedRatio, minCircles }`. */
  AARTI_INCOMPLETE: 'AARTI_INCOMPLETE',
  /** 422 — darshan ping shorter than `darshanPingSeconds`; `details: { seconds, minSeconds }`. */
  DARSHAN_TOO_SHORT: 'DARSHAN_TOO_SHORT',
  /** 404 — thali design unknown or inactive (§6.8). */
  THALI_NOT_AVAILABLE: 'THALI_NOT_AVAILABLE',
  /** 403 — thali design is neither free nor unlocked by the user (§6.8). */
  THALI_LOCKED: 'THALI_LOCKED',
  /** 409 — permanent item already unlocked, or free (§6.8). */
  ALREADY_UNLOCKED: 'ALREADY_UNLOCKED',

  // Coins
  /** 402 — balance too low; `details: { required, balance }`. */
  COINS_INSUFFICIENT: 'COINS_INSUFFICIENT',
} as const;

export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];
