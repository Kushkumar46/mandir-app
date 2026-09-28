import Constants from 'expo-constants';

type Extra = { apiUrl?: string; appEnv?: string; devUser?: string };

const API_PORT = 4000;

/**
 * API base URL (without `/v1`), in order:
 * 1. `API_URL` from app.config (EAS env, or `apps/devotee-app/.env.local` — see `pnpm dev:lan`);
 * 2. local dev only: the host the phone loaded the JS bundle from (the computer's LAN IP) on :4000;
 * 3. `http://localhost:4000` (iOS simulator).
 */
export function resolveApiUrl(input: { apiUrl?: string; appEnv: string; hostUri?: string | null }): string {
  if (input.apiUrl) return input.apiUrl.replace(/\/+$/, '');
  const host = input.hostUri?.split(':')[0];
  if (input.appEnv === 'local' && host) return `http://${host}:${API_PORT}`;
  return `http://localhost:${API_PORT}`;
}

const extra = (Constants.expoConfig?.extra ?? {}) as Extra;
const appEnv = extra.appEnv ?? 'local';

export const env = {
  apiUrl: resolveApiUrl({ apiUrl: extra.apiUrl, appEnv, hostUri: Constants.expoConfig?.hostUri }),
  appEnv,
  appVersion: Constants.expoConfig?.version ?? '0.0.0',
  /** DEV_AUTH stub user (`X-Dev-User`) until the Auth module exists; never sent in production. */
  devUser: appEnv === 'production' ? undefined : extra.devUser,
} as const;
