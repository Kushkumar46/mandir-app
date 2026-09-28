import { MandirFlag, type ImageVariantUrls } from '@mandir/shared-types';
import { Image } from 'expo-image';
import { useEffect } from 'react';

import { ApiError } from '@/api/client';
import { useConnectivityStore } from '@/api/connectivity';
import { useMandirHomeQuery } from '@/api/mandir';
import { useFlag } from '@/features/config/flags';

import { resolveSelectedDeity } from '../deity-selection';
import { useDeitySelectionStore } from '../store/selection';

/** Everything VM-01 renders: home payload, the selected deity and the offline state. */
export function useMandirHome() {
  const enabled = useFlag(MandirFlag.ENABLED);
  const home = useMandirHomeQuery(enabled);
  const selectedId = useDeitySelectionStore((s) => s.selectedDeityId);
  const data = home.data;
  const deity = data ? resolveSelectedDeity(data.deities, selectedId, data.defaultDeityId) : null;

  const networkError = home.error instanceof ApiError && home.error.isNetworkError;
  const lastRequestOffline = useConnectivityStore((s) => s.offline);
  return {
    enabled,
    home,
    data,
    deity,
    todayOfferings: data && deity ? data.todayOfferings[deity.id] : undefined,
    /**
     * The last request could not reach the server: showing the last loaded scene (also restored
     * from disk on a cold start, T14).
     */
    offline: !!data && lastRequestOffline,
    /** No scene was ever loaded and there is no internet (fresh install offline): the fallback mandir. */
    offlineNoData: !data && networkError,
  };
}

/**
 * §3.1 step 3: prefetch every deity's `card` and the variant VM-01 draws, so switching deity is
 * instant. Downloads go to the disk cache; only the image on screen is decoded.
 */
export function usePrefetchDeityImages(images: readonly (ImageVariantUrls | null | undefined)[], variant: keyof ImageVariantUrls) {
  const urls = images.flatMap((u) => (u ? [u.card, u[variant]] : []));
  const key = urls.join('|');
  useEffect(() => {
    if (!key) return;
    void Image.prefetch(key.split('|'), 'disk').catch(() => undefined);
  }, [key]);
}
