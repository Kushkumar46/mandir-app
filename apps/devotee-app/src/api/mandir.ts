import {
  type AartiCompleteRequest,
  aartiCompleteResponseSchema,
  type AartiLyrics,
  aartiLyricsSchema,
  type AartiView,
  type DarshanOutcome,
  deityAartisSchema,
  deityListItemSchema,
  deityOfferingsSchema,
  type HomeThali,
  type MakeOfferingRequest,
  type MakeOfferingResponse,
  makeOfferingResponseSchema,
  type MandirHome,
  mandirHomeSchema,
  type SetMandirDeitiesRequest,
  setMandirDeitiesResponseSchema,
  selectThaliResponseSchema,
  type ThaliList,
  thaliListSchema,
  type ThaliView,
  unlockThaliResponseSchema,
} from '@mandir/shared-types';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';

import { apiRequest, fetchPublicJson } from './client';
import { NOT_A_SERVER_ANSWER } from './connectivity';
import { queryKeys } from './keys';

/** `GET /v1/mandir/home` — everything VM-01 needs in one call. */
export function useMandirHomeQuery(enabled = true) {
  return useQuery({
    queryKey: queryKeys.mandirHome,
    queryFn: ({ signal }) => apiRequest('/mandir/home', { schema: mandirHomeSchema, signal }),
    enabled,
  });
}

/** `GET /v1/deities` — all active deities with the image the user would see (Sangrah grid). */
export function useDeitiesQuery() {
  return useQuery({
    queryKey: queryKeys.deities,
    queryFn: ({ signal }) => apiRequest('/deities', { schema: z.array(deityListItemSchema), signal }),
  });
}

const SET_DEITIES_KEY = ['mandir', 'set-deities'] as const;

/**
 * `PUT /v1/mandir/deities` — replaces the user's deity list (order + pin). Saves run one at a time
 * in call order (`scope`), so the last change wins. The cached home is updated right away and
 * refetched afterwards (added deities need their image, special offering etc. from the server).
 */
export function useSetMandirDeitiesMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: SET_DEITIES_KEY,
    scope: { id: 'mandir-deities' },
    mutationFn: (body: SetMandirDeitiesRequest) =>
      apiRequest('/mandir/deities', { method: 'PUT', body, schema: setMandirDeitiesResponseSchema }),
    onMutate: async (body) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.mandirHome });
      queryClient.setQueryData<MandirHome>(queryKeys.mandirHome, (home) => home && applyDeityListToHome(home, body));
    },
    // Refetch once the last queued save has finished (this one still counts as pending here).
    onSettled: () =>
      queryClient.isMutating({ mutationKey: SET_DEITIES_KEY }) > 1
        ? undefined
        : Promise.all([
            queryClient.invalidateQueries({ queryKey: queryKeys.mandirHome }),
            queryClient.invalidateQueries({ queryKey: queryKeys.deities }),
          ]),
  });
}

/**
 * A saved deity list applied to the cached home payload: kept deities reordered and re-pinned,
 * removed ones dropped. Added deities appear with the refetch.
 */
export function applyDeityListToHome(home: MandirHome, { items }: SetMandirDeitiesRequest): MandirHome {
  const byId = new Map(home.deities.map((d) => [d.id, d]));
  const deities = [...items]
    .sort((a, b) => a.position - b.position)
    .flatMap((i) => {
      const d = byId.get(i.deityId);
      return d ? [{ ...d, position: i.position, isPinned: i.isPinned }] : [];
    });
  return { ...home, deities };
}

/**
 * `GET /v1/deities/:deityId/offerings` — VM-05 items for the deity, grouped by kind. Items change
 * only when admin edits them, so the list stays fresh for 10 minutes.
 */
export function useDeityOfferingsQuery(deityId: string | undefined, enabled = true) {
  return useQuery({
    queryKey: queryKeys.deityOfferings(deityId ?? ''),
    queryFn: ({ signal }) => apiRequest(`/deities/${deityId}/offerings`, { schema: deityOfferingsSchema, signal }),
    enabled: enabled && !!deityId,
    staleTime: 10 * 60_000,
  });
}

/**
 * `POST /v1/mandir/offerings`. The caller passes the `Idempotency-Key`: a fresh one per tap, reused
 * when a queued offline offering is sent later (coins are spent server-side; mutations never retry).
 * On success the cached home takes the server's balance, streak and today's offerings for the
 * deity — the app never computes the balance itself.
 */
export function useMakeOfferingMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: ['mandir', 'offering'],
    mutationFn: ({ body, idempotencyKey }: { body: MakeOfferingRequest; idempotencyKey: string }) =>
      apiRequest('/mandir/offerings', { method: 'POST', body, schema: makeOfferingResponseSchema, idempotencyKey }),
    onSuccess: (res, { body }) => {
      queryClient.setQueryData<MandirHome>(queryKeys.mandirHome, (home) => home && applyOfferingToHome(home, body.deityId, res));
    },
  });
}

/** The server's answer to an offering applied to the cached home payload. */
export function applyOfferingToHome(home: MandirHome, deityId: string, res: MakeOfferingResponse): MandirHome {
  return {
    ...home,
    coins: { balance: res.coinsBalance },
    streak: { current: res.streak.current, longest: res.streak.longest, doneToday: res.streak.doneToday },
    todayOfferings: { ...home.todayOfferings, [deityId]: res.todayOfferings },
  };
}

/**
 * `GET /v1/deities/:deityId/aartis` — VM-06 aartis (default first). Aartis change only when admin
 * edits them, so the list stays fresh for 10 minutes.
 */
export function useDeityAartisQuery(deityId: string | undefined, enabled = true) {
  return useQuery({
    queryKey: queryKeys.deityAartis(deityId ?? ''),
    queryFn: ({ signal }) => apiRequest(`/deities/${deityId}/aartis`, { schema: deityAartisSchema, signal }),
    enabled: enabled && !!deityId,
    staleTime: 10 * 60_000,
  });
}

export type LyricsCache = {
  read: (aarti: Pick<AartiView, 'id' | 'version'>) => AartiLyrics | null;
  write: (aarti: Pick<AartiView, 'id' | 'version'>, lyrics: AartiLyrics) => void;
};

/**
 * The lyrics timeline file of an aarti version (never changes: a new text is a new version). With a
 * `cache`, the device copy is used first and a downloaded file is saved (§4.5, T14).
 */
export function useAartiLyricsQuery(aarti: Pick<AartiView, 'id' | 'version' | 'lyricsUrl'> | undefined, cache?: LyricsCache) {
  return useQuery({
    queryKey: queryKeys.aartiLyrics(aarti?.id ?? '', aarti?.version ?? 0),
    queryFn: async ({ signal }) => {
      const cached = cache?.read(aarti!);
      if (cached) return cached;
      const lyrics = await fetchPublicJson(aarti!.lyricsUrl, { schema: aartiLyricsSchema, signal });
      cache?.write(aarti!, lyrics);
      return lyrics;
    },
    enabled: !!aarti,
    staleTime: Infinity,
    // Often answered from the device cache: says nothing about the connection.
    meta: NOT_A_SERVER_ANSWER,
  });
}

/**
 * `POST /v1/mandir/rituals/aarti-complete`. The caller passes one `Idempotency-Key` per completed
 * aarti (a retry of the same completion reuses it; the request pays rewards). On success the cached
 * home takes the server's balance and streak.
 */
export function useAartiCompleteMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: ['mandir', 'aarti-complete'],
    mutationFn: ({ body, idempotencyKey }: { body: AartiCompleteRequest; idempotencyKey: string }) =>
      apiRequest('/mandir/rituals/aarti-complete', { method: 'POST', body, schema: aartiCompleteResponseSchema, idempotencyKey }),
    onSuccess: (res) => {
      queryClient.setQueryData<MandirHome>(queryKeys.mandirHome, (home) => home && applyDarshanOutcomeToHome(home, res));
    },
  });
}

/** Balance and streak of a darshan-day answer (offering, aarti, ping) applied to the cached home. */
export function applyDarshanOutcomeToHome(home: MandirHome, res: Pick<DarshanOutcome, 'coinsBalance' | 'streak'>): MandirHome {
  return {
    ...home,
    coins: { balance: res.coinsBalance },
    streak: { current: res.streak.current, longest: res.streak.longest, doneToday: res.streak.doneToday },
  };
}

/** `GET /v1/mandir/thalis` — VM-06 thali picker (only while `mandir.thali_designs` is on). */
export function useThalisQuery(enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.thalis,
    queryFn: ({ signal }) => apiRequest('/mandir/thalis', { schema: thaliListSchema, signal }),
    enabled,
    staleTime: 5 * 60_000,
  });
}

/**
 * `POST /v1/mandir/thalis/:thaliId/unlock` (§6.8) — debits the design's coins once. The caller passes
 * one `Idempotency-Key` per confirm sheet, so a retry after a lost answer never pays twice.
 */
export function useUnlockThaliMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: ['mandir', 'thali-unlock'],
    mutationFn: ({ thaliId, idempotencyKey }: { thaliId: string; idempotencyKey: string }) =>
      apiRequest(`/mandir/thalis/${thaliId}/unlock`, { method: 'POST', schema: unlockThaliResponseSchema, idempotencyKey }),
    onSuccess: (res) => {
      queryClient.setQueryData<MandirHome>(queryKeys.mandirHome, (home) => home && { ...home, coins: { balance: res.coinsBalance } });
      queryClient.setQueryData<ThaliList>(queryKeys.thalis, (list) => list && markThaliUnlocked(list, res.thaliId));
    },
  });
}

export function markThaliUnlocked(list: ThaliList, thaliId: string): ThaliList {
  return { ...list, items: list.items.map((i) => (i.id === thaliId ? { ...i, unlocked: true } : i)) };
}

/**
 * `PUT /v1/mandir/thali` — select a free or unlocked design. Shown at once (thali list + home
 * `thali`); a failed save puts the previous selection back.
 */
export function useSelectThaliMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: ['mandir', 'thali-select'],
    scope: { id: 'mandir-thali' },
    mutationFn: (thali: ThaliView) =>
      apiRequest('/mandir/thali', { method: 'PUT', body: { thaliId: thali.id }, schema: selectThaliResponseSchema }),
    onMutate: async (thali) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.thalis });
      const prev = {
        list: queryClient.getQueryData<ThaliList>(queryKeys.thalis),
        home: queryClient.getQueryData<MandirHome>(queryKeys.mandirHome)?.thali,
      };
      applyThaliSelection(queryClient, thali);
      return prev;
    },
    onError: (_e, _thali, prev) => {
      if (prev?.list) queryClient.setQueryData(queryKeys.thalis, prev.list);
      if (prev) queryClient.setQueryData<MandirHome>(queryKeys.mandirHome, (home) => home && { ...home, thali: prev.home ?? null });
    },
  });
}

function applyThaliSelection(queryClient: ReturnType<typeof useQueryClient>, thali: ThaliView) {
  queryClient.setQueryData<ThaliList>(queryKeys.thalis, (list) => list && selectThaliInList(list, thali.id));
  const homeThali: HomeThali = { id: thali.id, imageUrl: thali.imageUrl, flameStyle: thali.flameStyle };
  queryClient.setQueryData<MandirHome>(queryKeys.mandirHome, (home) => home && { ...home, thali: homeThali });
}

export function selectThaliInList(list: ThaliList, thaliId: string): ThaliList {
  return { selectedThaliId: thaliId, items: list.items.map((i) => ({ ...i, selected: i.id === thaliId })) };
}
