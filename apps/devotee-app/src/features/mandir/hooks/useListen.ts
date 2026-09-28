import { type DeityAartis, deityAartisSchema, type HomeDeity } from '@mandir/shared-types';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';

import { ApiError, apiRequest } from '@/api/client';
import { queryKeys } from '@/api/keys';
import { useSettingsStore } from '@/features/settings/store';
import { showToast } from '@/features/shell/Toast';
import { useLanguageStore } from '@/lib/language';

import { cacheAartiAudio, cachedAudioUri } from '../aarti-cache';
import { playAarti, stopAarti, useAartiPlayerStore } from '../aarti-player';
import { aartiTrack } from './useAartiSession';

/**
 * VM-01 "Listen": plays the deity's default aarti in the background without aarti mode (lock-screen
 * controls included), from the device copy when there is one (T14). A second tap stops it.
 */
export function useListen(deity: HomeDeity | null, offline: boolean) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const language = useLanguageStore((s) => s.language);
  const silentMode = useSettingsStore((s) => s.aartiInSilentMode);
  const listening = useAartiPlayerStore((s) => s.mode === 'listen' && !!deity && s.track?.deityId === deity.id);

  const aartisOf = async (d: HomeDeity): Promise<DeityAartis> => {
    const key = queryKeys.deityAartis(d.id);
    try {
      return await queryClient.fetchQuery({
        queryKey: key,
        queryFn: ({ signal }) => apiRequest(`/deities/${d.id}/aartis`, { schema: deityAartisSchema, signal }),
        staleTime: 10 * 60_000,
      });
    } catch (e) {
      // Offline: the saved list (T14) is good enough to find the downloaded file.
      const saved = queryClient.getQueryData<DeityAartis>(key);
      if (saved && e instanceof ApiError && e.isNetworkError) return saved;
      throw e;
    }
  };

  const toggle = async () => {
    if (!deity) return;
    if (listening) return stopAarti();
    try {
      const { items } = await aartisOf(deity);
      const aarti = items.find((a) => a.id === deity.defaultAartiId) ?? items[0];
      if (!aarti) return showToast(t('mandir.aartiMode.none'));
      const local = cachedAudioUri(aarti);
      if (!local && offline) return showToast(t('mandir.aartiMode.notDownloaded'));
      playAarti(aartiTrack(aarti, deity, language, local ?? aarti.audioUrl), 'listen', { playsInSilentMode: silentMode });
      if (!local) void cacheAartiAudio(aarti);
    } catch (e) {
      showToast(e instanceof ApiError && e.isNetworkError ? t('common.connectInternet') : t('common.somethingWentWrong'));
    }
  };

  return { listening, toggle: () => void toggle() };
}
