/**
 * Fixed IDs of the users created by `pnpm db:seed` for the DEV_AUTH stub.
 * `X-Dev-User` accepts either the UUID or the alias (`dev-user`, `dev-admin`).
 */
export const DEV_USERS = {
  'dev-user': { id: '00000000-0000-4000-8000-000000000001', name: 'Dev User', role: 'USER' },
  'dev-admin': { id: '00000000-0000-4000-8000-000000000002', name: 'Dev Admin', role: 'ADMIN' },
} as const;

export function resolveDevUserId(headerValue: string): string {
  const alias = DEV_USERS[headerValue as keyof typeof DEV_USERS];
  return alias ? alias.id : headerValue;
}
