import {
  deityListItemSchema,
  deityOfferingsSchema,
  type MakeOfferingRequest,
  type MakeOfferingResponse,
  makeOfferingResponseSchema,
  type MandirHome,
  mandirHomeSchema,
  type SetMandirDeitiesRequest,
  setMandirDeitiesResponseSchema,
} from '@mandir/shared-types';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';

import { newIdempotencyKey } from '@/lib/uuid';

import { apiRequest } from './client';
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
 * `POST /v1/mandir/offerings` with a fresh `Idempotency-Key` per tap (coins are spent server-side;
 * mutations never retry). On success the cached home takes the server's balance, streak and today's
 * offerings for the deity — the app never computes the balance itself.
 */
export function useMakeOfferingMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: ['mandir', 'offering'],
    mutationFn: (body: MakeOfferingRequest) =>
      apiRequest('/mandir/offerings', {
        method: 'POST',
        body,
        schema: makeOfferingResponseSchema,
        idempotencyKey: newIdempotencyKey(),
      }),
    onSuccess: (res, body) => {
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
