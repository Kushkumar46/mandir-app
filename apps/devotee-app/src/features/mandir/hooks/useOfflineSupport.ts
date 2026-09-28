import type { HomeDeity } from '@mandir/shared-types';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';

import { useDeityAartisQuery } from '@/api/mandir';

import { cacheAartiAudio, cacheAartiLyrics, cachedAudioUri } from '../aarti-cache';
import { flushOfflineQueue, useOfflineQueueStore } from '../offline-queue';

/**
 * §3.1 step 3: the current deity's aarti list and default aarti (audio + lyrics) are fetched with the
 * scene and downloaded to the device, so aarti and Listen also work offline later (T14).
 */
export function usePrefetchDefaultAarti(deity: HomeDeity | null, offline: boolean) {
  const aartis = useDeityAartisQuery(deity?.id, !!deity);
  const items = aartis.data?.items;
  const aarti = items?.find((a) => a.id === deity?.defaultAartiId) ?? items?.[0];

  useEffect(() => {
    if (!aarti || offline) return;
    if (!cachedAudioUri(aarti)) void cacheAartiAudio(aarti);
    void cacheAartiLyrics(aarti);
  }, [aarti, offline]);
}

/**
 * Sends the offline queue (T14) at launch and whenever a request reaches the server again (the
 * connection state flips back to online).
 */
export function useOfflineQueueFlush(offline: boolean) {
  const queryClient = useQueryClient();
  const pending = useOfflineQueueStore((s) => s.items.length > 0);

  useEffect(() => {
    if (pending && !offline) void flushOfflineQueue(queryClient);
  }, [pending, offline, queryClient]);
}
