import type { AppConfig } from '@mandir/shared-types';

import { useAppConfigQuery } from '@/api/config';

/** Unknown flags and a config that has not loaded yet count as off: features ship "off" (CLAUDE.md §6.4). */
export function isFlagEnabled(config: AppConfig | undefined, key: string): boolean {
  return config?.flags[key]?.enabled === true;
}

export function useAppConfig() {
  return useAppConfigQuery().data;
}

/** `useFlag(MandirFlag.OFFERINGS)` — true only when the server says the flag is on for this user. */
export function useFlag(key: string): boolean {
  return isFlagEnabled(useAppConfig(), key);
}

export function useRemoteConfig() {
  return useAppConfig()?.remoteConfig;
}
