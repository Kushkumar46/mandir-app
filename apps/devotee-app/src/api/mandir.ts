import {
  deityListItemSchema,
  type MandirHome,
  mandirHomeSchema,
  type SetMandirDeitiesRequest,
  setMandirDeitiesResponseSchema,
} from '@mandir/shared-types';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';

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
