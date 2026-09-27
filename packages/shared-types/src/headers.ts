/** HTTP header names shared by the API and its clients (lower-case, as Node exposes them). */
export const Header = {
  IDEMPOTENCY_KEY: 'idempotency-key',
  /** DEV_AUTH stub only — never honoured in production. */
  DEV_USER: 'x-dev-user',
  APP_VERSION: 'x-app-version',
  PLATFORM: 'x-platform',
} as const;
