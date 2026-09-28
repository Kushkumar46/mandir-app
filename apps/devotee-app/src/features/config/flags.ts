import { type AppConfig, MandirFlag } from '@mandir/shared-types';

import { ApiError } from '@/api/client';
import { useAppConfigQuery } from '@/api/config';

/** Unknown flags and a config that has not loaded yet count as off: features ship "off" (CLAUDE.md §6.4). */
export function isFlagEnabled(config: AppConfig | undefined, key: string): boolean {
  return config?.flags[key]?.enabled === true;
}

/**
 * First launch without internet (no server answer and nothing cached, T14): only the mandir itself
 * is on, so the fallback mandir (bundled artwork + bells) opens instead of an error screen. Every
 * other feature stays off until the real config arrives.
 */
export const OFFLINE_FALLBACK_CONFIG: AppConfig = {
  flags: { [MandirFlag.ENABLED]: { enabled: true, payload: null } },
  remoteConfig: { minSupportedAppVersion: '0.0.0', supportWhatsapp: null },
  forceUpdate: false,
  serverTime: new Date(0).toISOString(),
};

/** The config to use: the server's (fresh or cached), else the offline fallback when the server can't be reached. */
export function effectiveConfig(data: AppConfig | undefined, error: unknown): AppConfig | undefined {
  if (data) return data;
  return error instanceof ApiError && error.isNetworkError ? OFFLINE_FALLBACK_CONFIG : undefined;
}

export function useAppConfig() {
  const query = useAppConfigQuery();
  return effectiveConfig(query.data, query.error);
}

/** `useFlag(MandirFlag.OFFERINGS)` — true only when the server says the flag is on for this user. */
export function useFlag(key: string): boolean {
  return isFlagEnabled(useAppConfig(), key);
}

export function useRemoteConfig() {
  return useAppConfig()?.remoteConfig;
}
