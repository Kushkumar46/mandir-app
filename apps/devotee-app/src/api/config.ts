import { appConfigSchema } from '@mandir/shared-types';
import { useQuery } from '@tanstack/react-query';

import { apiRequest } from './client';
import { queryKeys } from './keys';

/** Config is refetched when the app returns to the foreground and it is older than this. */
export const CONFIG_STALE_MS = 30 * 60_000;

/** `GET /v1/config` — flags evaluated for this user/app version/platform + remote config. */
export function useAppConfigQuery() {
  return useQuery({
    queryKey: queryKeys.config,
    queryFn: ({ signal }) => apiRequest('/config', { schema: appConfigSchema, signal }),
    staleTime: CONFIG_STALE_MS,
    gcTime: Infinity,
    // Without any config (first launch offline → fallback config) keep trying every 30 s.
    refetchInterval: (query) => (query.state.data ? false : 30_000),
  });
}
