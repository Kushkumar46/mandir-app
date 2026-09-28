import { focusManager, QueryClient } from '@tanstack/react-query';
import { AppState, Platform } from 'react-native';

import { ApiError } from './client';

/** 4xx answers are final (except 408/429); network errors and 5xx get two retries. */
export function shouldRetry(failureCount: number, error: unknown): boolean {
  if (error instanceof ApiError && error.status >= 400 && error.status < 500) {
    return error.status === 408 || error.status === 429 ? failureCount < 1 : false;
  }
  return failureCount < 2;
}

export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: shouldRetry, staleTime: 60_000 },
      // Writes are never retried blindly; spends carry an Idempotency-Key and are retried by the feature.
      mutations: { retry: false },
    },
  });
}

/** React Query's "window focus" = app back in the foreground (refetches stale queries, e.g. config). */
export function subscribeAppFocus(): () => void {
  const sub = AppState.addEventListener('change', (status) => {
    if (Platform.OS !== 'web') focusManager.setFocused(status === 'active');
  });
  return () => sub.remove();
}
