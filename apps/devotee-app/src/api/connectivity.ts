import { MutationCache, QueryCache } from '@tanstack/react-query';
import { create } from 'zustand';

import { ApiError } from './client';

/**
 * Last known connection state (T14): a request that could not reach the server → offline; any
 * answer from the server (success or an HTTP error) → online. Fed by every React Query query and
 * mutation, plus the offline queue's own requests. Screens use it for their offline state, so a
 * local cache update (e.g. a queued offering shown in the home) never makes the app look online.
 */
export const useConnectivityStore = create<{ offline: boolean }>(() => ({ offline: false }));

/** Call with the error of a finished request, or nothing when it succeeded. Other errors are ignored. */
export function noteRequestResult(error?: unknown) {
  if (error === undefined) return setOffline(false);
  if (error instanceof ApiError) setOffline(error.isNetworkError);
}

function setOffline(offline: boolean) {
  if (useConnectivityStore.getState().offline !== offline) useConnectivityStore.setState({ offline });
}

/** Queries answered from the device (e.g. cached lyrics) set `meta: NOT_A_SERVER_ANSWER` so they never count as "online". */
export const NOT_A_SERVER_ANSWER = { trackConnectivity: false } as const;
const tracked = (meta: Record<string, unknown> | undefined) => meta?.trackConnectivity !== false;

/** Query + mutation caches that report every server result to the connectivity store. */
export function connectivityCaches() {
  return {
    queryCache: new QueryCache({
      onSuccess: (_data, query) => tracked(query.meta) && noteRequestResult(),
      onError: (e, query) => tracked(query.meta) && noteRequestResult(e),
    }),
    mutationCache: new MutationCache({ onSuccess: () => noteRequestResult(), onError: (e) => noteRequestResult(e) }),
  };
}
