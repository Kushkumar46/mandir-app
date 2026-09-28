import { ErrorCode, MandirFlag, type ThaliView } from '@mandir/shared-types';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { ApiError } from '@/api/client';
import { queryKeys } from '@/api/keys';
import { markThaliUnlocked, useSelectThaliMutation, useThalisQuery, useUnlockThaliMutation } from '@/api/mandir';
import { useFlag } from '@/features/config/flags';
import { showToast } from '@/features/shell/Toast';
import { track } from '@/lib/analytics';
import { pickLocalized, useLanguageStore } from '@/lib/language';
import { newIdempotencyKey } from '@/lib/uuid';

import { decideOffering } from '../offerings';
import { useOfferingStore } from '../store/offerings';

/**
 * VM-06 thali picker (§6.8, flag `mandir.thali_designs`): tap an unlocked design → `PUT /mandir/thali`
 * (shown at once); a locked one → "अनलॉक करें — X सिक्के" sheet, or the coin sheet when the last
 * server balance is too low. Unlock = `POST /mandir/thalis/:id/unlock` with one Idempotency-Key per
 * sheet (a retry after a lost answer never pays twice); the new design is then selected.
 */
export function useThaliPicker({ open, balance, offline }: { open: boolean; balance: number | undefined; offline: boolean }) {
  const { t } = useTranslation();
  const language = useLanguageStore((s) => s.language);
  const enabled = useFlag(MandirFlag.THALI_DESIGNS);
  const queryClient = useQueryClient();
  const thalis = useThalisQuery(enabled && open);
  const select = useSelectThaliMutation();
  const unlock = useUnlockThaliMutation();
  const [unlocking, setUnlocking] = useState<{ thali: ThaliView; key: string } | null>(null);

  useEffect(() => {
    if (enabled && open) track('thali_picker_opened');
  }, [enabled, open]);

  const refetch = () => void queryClient.invalidateQueries({ queryKey: queryKeys.thalis });
  const failed = (e: unknown, unavailableText: string) => {
    if (!(e instanceof ApiError)) return showToast(t('common.somethingWentWrong'));
    if (e.isNetworkError) return showToast(t('common.connectInternet'));
    if (e.code === ErrorCode.RATE_LIMITED) return showToast(t('common.tryLater'));
    if (e.code === ErrorCode.FEATURE_DISABLED) void queryClient.invalidateQueries({ queryKey: queryKeys.config });
    if (e.status === 403 || e.status === 404) {
      refetch();
      return showToast(unavailableText);
    }
    showToast(t('common.somethingWentWrong'));
  };

  const choose = (thali: ThaliView) => {
    track('thali_selected', { thaliId: thali.id });
    select.mutate(thali, { onError: (e) => failed(e, t('mandir.thali.unavailable')) });
  };

  const onPick = (thali: ThaliView) => {
    if (thali.selected) return;
    // Selecting and unlocking need the server (T14 offline state).
    if (offline) return showToast(t('common.connectInternet'));
    if (thali.unlocked) return choose(thali);
    const decision = decideOffering(thali, balance);
    if (decision.kind === 'insufficient') {
      useOfferingStore.getState().showCoinsNeeded(decision.required, decision.balance);
      return;
    }
    setUnlocking({ thali, key: newIdempotencyKey() });
  };

  const confirmUnlock = () => {
    if (!unlocking || unlock.isPending) return;
    const { thali, key } = unlocking;
    const name = pickLocalized(language, thali.nameHi, thali.nameEn);
    const unlocked = () => {
      setUnlocking(null);
      showToast(t('mandir.thali.unlocked', { name }));
      choose({ ...thali, unlocked: true });
    };
    unlock.mutate(
      { thaliId: thali.id, idempotencyKey: key },
      {
        onSuccess: (res) => {
          track('thali_unlocked', { thaliId: thali.id, coins: res.coinsSpent });
          unlocked();
        },
        onError: (e) => {
          if (e instanceof ApiError && e.code === ErrorCode.ALREADY_UNLOCKED) {
            queryClient.setQueryData(queryKeys.thalis, (list: Parameters<typeof markThaliUnlocked>[0] | undefined) => list && markThaliUnlocked(list, thali.id));
            return unlocked();
          }
          if (e instanceof ApiError && e.code === ErrorCode.COINS_INSUFFICIENT) {
            setUnlocking(null);
            useOfferingStore.getState().showCoinsNeeded(Number(e.details.required ?? thali.coinCost), Number(e.details.balance ?? 0));
            void queryClient.invalidateQueries({ queryKey: queryKeys.mandirHome }); // the pill shows a stale balance
            return;
          }
          // Network / 429: the sheet stays open and a retry reuses the same key.
          if (e instanceof ApiError && (e.status === 403 || e.status === 404)) setUnlocking(null);
          failed(e, t('mandir.thali.unavailable'));
        },
      },
    );
  };

  return {
    enabled,
    items: thalis.data?.items,
    loading: thalis.isPending,
    onPick,
    unlocking: unlocking?.thali ?? null,
    unlockPending: unlock.isPending,
    confirmUnlock,
    cancelUnlock: () => setUnlocking(null),
  };
}
