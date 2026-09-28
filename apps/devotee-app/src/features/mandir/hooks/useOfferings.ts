import {
  type DeityOfferings,
  ErrorCode,
  type MakeOfferingResponse,
  MandirFlag,
  type OfferingItemView,
  type OfferingKind,
  type TodayOfferings,
} from '@mandir/shared-types';
import { useQueryClient } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';

import { ApiError } from '@/api/client';
import { queryKeys } from '@/api/keys';
import { useDeityOfferingsQuery, useMakeOfferingMutation } from '@/api/mandir';
import { useFlag } from '@/features/config/flags';
import { showToast } from '@/features/shell/Toast';
import { track } from '@/lib/analytics';
import { impactMedium } from '@/lib/haptics';

import { preloadParticleSprites } from '../components/offerings/ParticleShower';
import { decideOffering, offeringAnimation } from '../offerings';
import { useOfferingStore } from '../store/offerings';
import { useRewardToast } from './useRewardToast';

/**
 * VM-05 items of the current deity. Loaded with the scene (not on sheet open) so the sheet opens
 * instantly and the feet area can draw today's offerings with their sprites; every sprite is
 * prefetched to disk, particle sprites are decoded for Skia ahead of the first tap.
 */
export function useDeityOfferings(deityId: string | undefined) {
  const enabled = useFlag(MandirFlag.OFFERINGS);
  const query = useDeityOfferingsQuery(deityId, enabled);
  const groups = query.data?.groups;

  useEffect(() => {
    if (!groups) return;
    const items = groups.flatMap((g) => g.items);
    void Image.prefetch([...new Set(items.flatMap((i) => [i.iconUrl, i.spriteUrl]))], 'disk').catch(() => undefined);
    preloadParticleSprites(items.filter((i) => offeringAnimation(i).type === 'particles').map((i) => i.spriteUrl));
  }, [groups]);

  return query;
}

/** Items of one kind, in the server's order (free basics first comes from the seed/admin order). */
export function itemsOfKind(offerings: DeityOfferings | undefined, kind: OfferingKind): OfferingItemView[] {
  return offerings?.groups.find((g) => g.kind === kind)?.items ?? [];
}

/**
 * Sprites the feet area draws for today's offerings: the item last offered to this deity in this
 * session, else the kind's first free item, else the first item (null → icon fallback).
 */
export function feetSprites(
  offerings: DeityOfferings | undefined,
  lastOffered: Partial<Record<OfferingKind, OfferingItemView>> | undefined,
) {
  const pick = (kind: OfferingKind) => {
    const items = itemsOfKind(offerings, kind);
    return lastOffered?.[kind] ?? items.find((i) => i.coinCost === 0) ?? items[0] ?? null;
  };
  const diya = pick('DIYA');
  const diyaAnimation = diya ? offeringAnimation(diya) : null;
  return {
    flower: pick('FLOWER')?.spriteUrl ?? null,
    mala: pick('MALA')?.spriteUrl ?? null,
    diya: diya?.spriteUrl ?? null,
    diyaLamps: diyaAnimation?.type === 'diya' ? diyaAnimation.lamps : 1,
    bhog: pick('BHOG')?.spriteUrl ?? null,
  } as const;
}
export type FeetSprites = ReturnType<typeof feetSprites>;

type Flow = {
  deityId: string | undefined;
  /** Last balance the server sent (home / previous offering). */
  balance: number | undefined;
  /** Today's offerings for the deity right now (the animation keeps these until it lands). */
  today: TodayOfferings | undefined;
  /** The last home refresh could not reach the server. */
  offline: boolean;
};

/**
 * VM-05 tap (§3.2): free → animation at once, logged in the background (a failed log is skipped
 * silently; the offline queue comes with T14); paid → `POST /mandir/offerings` first, animation on
 * success; not enough coins → placeholder coin sheet. Coins pill and feet area update from the
 * server's answer; rewards and new badges show a toast.
 */
export function useOfferingFlow({ deityId, balance, today, offline }: Flow) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const mutation = useMakeOfferingMutation();

  const rewardToast = useRewardToast();

  const onMade = (item: OfferingItemView, res: MakeOfferingResponse) => {
    track('offering_made', { itemId: item.id, kind: item.kind, coins: res.coinsSpent });
    rewardToast(res);
  };

  const unavailable = (e: ApiError) => {
    if (e.code === ErrorCode.FEATURE_DISABLED) void queryClient.invalidateQueries({ queryKey: queryKeys.config });
    if (deityId) void queryClient.invalidateQueries({ queryKey: queryKeys.deityOfferings(deityId) });
    showToast(t('mandir.offering.unavailable'));
  };

  const offer = (item: OfferingItemView) => {
    const store = useOfferingStore.getState();
    if (!deityId || !today || store.pendingItemId) return;
    const body = { deityId, offeringItemId: item.id };
    const decision = decideOffering(item, balance);

    if (decision.kind === 'insufficient') {
      track('offering_blocked', { reason: ErrorCode.COINS_INSUFFICIENT });
      store.closeSheet();
      store.showCoinsNeeded(decision.required, decision.balance);
      return;
    }

    if (decision.kind === 'free') {
      store.closeSheet();
      store.play(deityId, item, today);
      impactMedium();
      mutation.mutate(body, {
        onSuccess: (res) => onMade(item, res),
        onError: (e) => {
          // 429 / offline: keep the animation, skip the log (§6.5; queue in T14).
          if (e instanceof ApiError && e.status === 404) unavailable(e);
          else if (e instanceof ApiError && e.code === ErrorCode.FEATURE_DISABLED) unavailable(e);
        },
      });
      return;
    }

    if (offline) {
      track('offering_blocked', { reason: 'OFFLINE' });
      showToast(t('common.connectInternet'));
      return;
    }
    store.setPending(item.id);
    mutation.mutate(body, {
      onSuccess: (res) => {
        const s = useOfferingStore.getState();
        s.closeSheet();
        s.play(deityId, item, today);
        impactMedium();
        onMade(item, res);
      },
      onError: (e) => {
        useOfferingStore.getState().setPending(null);
        if (!(e instanceof ApiError)) return showToast(t('common.somethingWentWrong'));
        track('offering_blocked', { reason: e.code });
        if (e.code === ErrorCode.COINS_INSUFFICIENT) {
          const required = Number(e.details.required ?? item.coinCost);
          const serverBalance = Number(e.details.balance ?? 0);
          const s = useOfferingStore.getState();
          s.closeSheet();
          s.showCoinsNeeded(required, serverBalance);
          void queryClient.invalidateQueries({ queryKey: queryKeys.mandirHome }); // the pill shows a stale balance
        } else if (e.isNetworkError) showToast(t('common.connectInternet'));
        else if (e.code === ErrorCode.RATE_LIMITED) showToast(t('mandir.offering.tooFast'));
        else if (e.status === 404 || e.code === ErrorCode.FEATURE_DISABLED) unavailable(e);
        else showToast(t('common.somethingWentWrong'));
      },
    });
  };

  return { offer };
}
