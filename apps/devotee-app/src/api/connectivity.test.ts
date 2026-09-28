import { createTestQueryClient } from '@/test/mandir-fixtures';

import { ApiError } from './client';
import { NOT_A_SERVER_ANSWER, noteRequestResult, useConnectivityStore } from './connectivity';

const offline = () => useConnectivityStore.getState().offline;
const NETWORK = new ApiError(0, 'NETWORK_ERROR', 'offline');

beforeEach(() => useConnectivityStore.setState({ offline: false }));

describe('connectivity (T14)', () => {
  it('network failure → offline; any server answer (even an error) → online; other errors ignored', () => {
    noteRequestResult(NETWORK);
    expect(offline()).toBe(true);
    noteRequestResult(new Error('bug'));
    expect(offline()).toBe(true);
    noteRequestResult(new ApiError(404, 'NOT_FOUND', 'gone'));
    expect(offline()).toBe(false);
    noteRequestResult(NETWORK);
    noteRequestResult();
    expect(offline()).toBe(false);
  });

  it('is fed by queries and mutations, except answers from the device', async () => {
    const client = createTestQueryClient();
    await client.fetchQuery({ queryKey: ['a'], queryFn: () => Promise.reject(NETWORK) }).catch(() => undefined);
    expect(offline()).toBe(true);
    await client.fetchQuery({ queryKey: ['lyrics'], queryFn: () => Promise.resolve([]), meta: NOT_A_SERVER_ANSWER });
    expect(offline()).toBe(true);
    await client.fetchQuery({ queryKey: ['b'], queryFn: () => Promise.resolve(1) });
    expect(offline()).toBe(false);
    await client
      .getMutationCache()
      .build(client, { mutationFn: () => Promise.reject(NETWORK) })
      .execute(undefined)
      .catch(() => undefined);
    expect(offline()).toBe(true);
  });
});
