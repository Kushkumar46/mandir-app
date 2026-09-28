import type { SupportedLanguage } from '@mandir/i18n';
import { type AartiCompleteResponse, type AartiView, ErrorCode, type HomeDeity } from '@mandir/shared-types';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useEffectEvent, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useReducedMotion } from 'react-native-reanimated';

import { ApiError } from '@/api/client';
import { queryKeys } from '@/api/keys';
import { useAartiCompleteMutation, useAartiLyricsQuery, useDeityAartisQuery } from '@/api/mandir';
import { useSettingsStore } from '@/features/settings/store';
import { track } from '@/lib/analytics';
import { pickLocalized, useLanguageStore } from '@/lib/language';
import { newIdempotencyKey } from '@/lib/uuid';

import { isAartiComplete, playedRatioOf } from '../aarti';
import { type AartiTrack, playAarti, useAartiPlayerStore } from '../aarti-player';
import { AUTO_CIRCLE_MS, AUTO_CIRCLE_MS_REDUCED_MOTION, autoCircles } from '../animations/thali';
import { useRewardToast } from './useRewardToast';

function completionError(e: unknown, t: (key: string) => string): string {
  if (e instanceof ApiError && e.isNetworkError) return t('common.connectInternet');
  if (e instanceof ApiError && e.code === ErrorCode.AARTI_NOT_AVAILABLE) return t('mandir.aartiMode.unavailable');
  return t('mandir.aartiMode.saveFailed');
}

export type CompletionState =
  | { status: 'none' }
  | { status: 'sending' }
  | { status: 'done'; res: AartiCompleteResponse }
  | { status: 'failed'; message: string };

/** Lock-screen track for an aarti of a deity (title = aarti name, artwork = deity thumb, §4.5). */
export function aartiTrack(aarti: AartiView, deity: HomeDeity, language: SupportedLanguage, uri: string = aarti.audioUrl): AartiTrack {
  return {
    aartiId: aarti.id,
    deityId: deity.id,
    title: pickLocalized(language, aarti.titleHi, aarti.titleEn),
    artist: pickLocalized(language, deity.nameHi, deity.nameEn),
    artworkUrl: deity.image?.urls.thumb,
    uri,
    durationSec: aarti.durationSec,
  };
}

/**
 * One VM-06 session (§3.3): picks the aarti (default first), starts its audio, counts thali circles
 * (manual full circles + Auto circles by elapsed Auto time, so they keep counting with the screen
 * locked), and once ≥ 90% is played and ≥ 3 circles are made posts `aarti-complete` once, with one
 * Idempotency-Key per aarti (a retry reuses it).
 */
export function useAartiSession(deity: HomeDeity) {
  const { t } = useTranslation();
  const language = useLanguageStore((s) => s.language);
  const silentMode = useSettingsStore((s) => s.aartiInSilentMode);
  const reduceMotion = useReducedMotion();
  const queryClient = useQueryClient();
  const aartis = useDeityAartisQuery(deity.id);
  const [aartiId, setAartiId] = useState<string | null>(null);
  const aarti = aartis.data?.items.find((a) => a.id === aartiId) ?? aartis.data?.items[0];
  const lyrics = useAartiLyricsQuery(aarti);
  const player = useAartiPlayerStore();
  const complete = useAartiCompleteMutation();
  const rewardToast = useRewardToast();

  // Session state, reset when the aarti changes.
  const [manualCircles, setManualCircles] = useState(0);
  /** Auto time: finished stretches (`ms`) + the running one since `since`. */
  const [autoClock, setAutoClock] = useState<{ ms: number; since: number | null }>({ ms: 0, since: null });
  const [now, setNow] = useState(() => Date.now());
  const [idempotencyKey, setIdempotencyKey] = useState(newIdempotencyKey);
  const [session, setSession] = useState(0);
  const auto = autoClock.since !== null;

  const autoPeriodMs = reduceMotion ? AUTO_CIRCLE_MS_REDUCED_MOTION : AUTO_CIRCLE_MS;
  const autoMs = autoClock.ms + (autoClock.since !== null ? Math.max(0, now - autoClock.since) : 0);
  const circles = manualCircles + autoCircles(autoMs, autoPeriodMs);
  const onThisAarti = !!aarti && player.track?.aartiId === aarti.id && player.mode === 'aarti';
  const playedRatio = onThisAarti ? playedRatioOf(player.played, player.duration) : 0;

  // Start (or restart) the audio for the chosen aarti.
  const audioUri = aarti?.audioUrl;
  useEffect(() => {
    if (!aarti || !audioUri) return;
    playAarti(aartiTrack(aarti, deity, language, audioUri), 'aarti', { playsInSilentMode: silentMode });
    track('aarti_started', { aartiId: aarti.id });
    // Only a different aarti (or its file) restarts the audio; language/settings changes don't.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aarti?.id, audioUri]);

  // Auto circles grow with time: tick 4×/s while Auto is on (status updates may stop when paused).
  useEffect(() => {
    if (!auto) return;
    const timer = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(timer);
  }, [auto]);

  const setAuto = (on: boolean) => {
    const at = Date.now();
    setNow(at);
    setAutoClock((c) => {
      if (on && c.since === null) return { ms: c.ms, since: at };
      if (!on && c.since !== null) return { ms: c.ms + (at - c.since), since: null };
      return c;
    });
  };

  const chooseAarti = (id: string) => {
    if (id === aarti?.id) return;
    const at = Date.now();
    setNow(at);
    setAutoClock((c) => ({ ms: 0, since: c.since === null ? null : at }));
    setIdempotencyKey(newIdempotencyKey());
    setManualCircles(0);
    complete.reset();
    setSession((n) => n + 1);
    setAartiId(id);
  };

  const submit = () => {
    if (!aarti) return;
    complete.mutate(
      {
        body: { deityId: deity.id, aartiId: aarti.id, playedRatio: Math.round(playedRatio * 1000) / 1000, circles },
        idempotencyKey,
      },
      {
        onSuccess: rewardToast,
        onError: (e) => {
          if (e instanceof ApiError && e.code === ErrorCode.AARTI_NOT_AVAILABLE) {
            void queryClient.invalidateQueries({ queryKey: queryKeys.deityAartis(deity.id) });
          }
        },
      },
    );
  };

  // VM-06 completion: the first time the rule holds → overlay + POST (the mutation state is the overlay's).
  const reached = onThisAarti && isAartiComplete({ playedRatio, circles });
  const startCompletion = useEffectEvent(() => {
    if (!aarti) return;
    track('aarti_completed', { aartiId: aarti.id, circles, auto });
    submit();
  });
  useEffect(() => {
    if (reached && complete.isIdle) startCompletion();
  }, [reached, complete.isIdle]);

  const completion: CompletionState = complete.isIdle
    ? { status: 'none' }
    : complete.isPending
      ? { status: 'sending' }
      : complete.data
        ? { status: 'done', res: complete.data }
        : { status: 'failed', message: completionError(complete.error, t) };

  return {
    aartis,
    aarti,
    chooseAarti,
    lyrics: lyrics.data,
    player,
    onThisAarti,
    playedRatio,
    circles,
    onManualCircles: setManualCircles,
    auto,
    setAuto,
    autoPeriodMs,
    completion,
    retry: submit,
    session,
  };
}
