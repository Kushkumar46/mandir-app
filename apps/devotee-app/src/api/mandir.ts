import { mandirHomeSchema } from '@mandir/shared-types';
import { useQuery } from '@tanstack/react-query';

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
