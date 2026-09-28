import { deityAartisSchema, type HomeDeity } from '@mandir/shared-types';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';

import { ApiError, apiRequest } from '@/api/client';
import { queryKeys } from '@/api/keys';
import { useSettingsStore } from '@/features/settings/store';
import { showToast } from '@/features/shell/Toast';
import { useLanguageStore } from '@/lib/language';

import { playAarti, stopAarti, useAartiPlayerStore } from '../aarti-player';
import { aartiTrack } from './useAartiSession';

/**
 * VM-01 "Listen": plays the deity's default aarti in the background without aarti mode (lock-screen
 * controls included). A second tap stops it. Returns whether this deity's aarti is playing.
 */
export function useListen(deity: HomeDeity | null) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const language = useLanguageStore((s) => s.language);
  const silentMode = useSettingsStore((s) => s.aartiInSilentMode);
  const listening = useAartiPlayerStore((s) => s.mode === 'listen' && !!deity && s.track?.deityId === deity.id);

  const toggle = async () => {
    if (!deity) return;
    if (listening) return stopAarti();
    try {
      const { items } = await queryClient.fetchQuery({
        queryKey: queryKeys.deityAartis(deity.id),
        queryFn: ({ signal }) => apiRequest(`/deities/${deity.id}/aartis`, { schema: deityAartisSchema, signal }),
        staleTime: 10 * 60_000,
      });
      const aarti = items.find((a) => a.id === deity.defaultAartiId) ?? items[0];
      if (!aarti) return showToast(t('mandir.aartiMode.none'));
      playAarti(aartiTrack(aarti, deity, language), 'listen', { playsInSilentMode: silentMode });
    } catch (e) {
      showToast(e instanceof ApiError && e.isNetworkError ? t('common.connectInternet') : t('common.somethingWentWrong'));
    }
  };

  return { listening, toggle: () => void toggle() };
}
