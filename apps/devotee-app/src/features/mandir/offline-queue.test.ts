import { ApiError, apiRequest } from '@/api/client';
import { queryKeys } from '@/api/keys';
import { aartiCompleteResponse, createTestQueryClient, HANUMAN, homePayload, offeringResponse, uuid } from '@/test/mandir-fixtures';

import {
  afterFailure,
  bumpTodayOfferings,
  deviceLocalDate,
  enqueue,
  flushOfflineQueue,
  OFFLINE_QUEUE_MAX,
  type QueuedAction,
  queueAartiComplete,
  queueOffering,
  resetOfflineQueue,
  useOfflineQueueStore,
} from './offline-queue';

jest.mock('@/api/client', () => ({ ...jest.requireActual('@/api/client'), apiRequest: jest.fn() }));

const api = apiRequest as jest.MockedFunction<typeof apiRequest>;
const fs = jest.requireMock('expo-file-system') as { __files: Map<string, string> };
const TODAY = '2026-09-29';
const offering = (n: number, localDate = TODAY): QueuedAction => ({
  kind: 'offering',
  key: uuid(n),
  localDate,
  createdAt: n,
  body: { deityId: HANUMAN, offeringItemId: uuid(500) },
  offeringKind: 'FLOWER',
});
const items = () => useOfflineQueueStore.getState().items;

beforeEach(() => {
  api.mockReset();
  resetOfflineQueue();
});

describe('offline queue (T14)', () => {
  it('keeps actions in order on the device, once per key, at most 60 offerings', () => {
    enqueue(offering(1));
    enqueue(offering(1));
    enqueue(offering(2));
    expect(items().map((i) => i.key)).toEqual([uuid(1), uuid(2)]);
    expect(JSON.parse(fs.__files.get('file:///documents/offline-queue.json')!)).toHaveLength(2);
    for (let n = 3; n <= OFFLINE_QUEUE_MAX + 5; n++) enqueue(offering(n));
    expect(items()).toHaveLength(OFFLINE_QUEUE_MAX);
    queueAartiComplete({ deityId: HANUMAN, aartiId: uuid(200), playedRatio: 1, circles: 3 }, uuid(99));
    expect(items().at(-1)).toMatchObject({ kind: 'aarti', key: uuid(99) }); // aartis are not capped
  });

  it('a queued offering shows in the cached home at once (display only, no coins)', () => {
    const client = createTestQueryClient();
    client.setQueryData(queryKeys.mandirHome, homePayload());
    queueOffering(client, { deityId: HANUMAN, offeringItemId: uuid(500) }, 'FLOWER', uuid(7));
    const home = client.getQueryData<ReturnType<typeof homePayload>>(queryKeys.mandirHome)!;
    expect(home.todayOfferings[HANUMAN].flowers).toBe(15);
    expect(home.coins.balance).toBe(42);
    expect(items()[0]).toMatchObject({ key: uuid(7), localDate: deviceLocalDate() });
  });

  it('bumps today’s offerings per kind', () => {
    const none = { flowers: 0, mala: false, diya: false, bhog: false };
    expect(bumpTodayOfferings(none, 'FLOWER')).toEqual({ ...none, flowers: 1 });
    expect(bumpTodayOfferings(none, 'MALA').mala).toBe(true);
    expect(bumpTodayOfferings(none, 'DIYA').diya).toBe(true);
    expect(bumpTodayOfferings(none, 'BHOG').bhog).toBe(true);
    expect(bumpTodayOfferings(none, 'SPECIAL')).toEqual(none);
  });

  it('sends in order with the original keys and applies each answer to the home', async () => {
    const client = createTestQueryClient();
    client.setQueryData(queryKeys.mandirHome, homePayload());
    resetOfflineQueue([offering(1), { kind: 'aarti', key: uuid(2), localDate: TODAY, createdAt: 2, body: { deityId: HANUMAN, aartiId: uuid(200), playedRatio: 1, circles: 3 } }]);
    api.mockImplementation(((path: string) =>
      Promise.resolve(path === '/mandir/offerings' ? offeringResponse({ coinsBalance: 43 }) : aartiCompleteResponse({ coinsBalance: 45 }))) as never);

    await flushOfflineQueue(client, TODAY);
    expect(api.mock.calls.map(([p, o]) => [p, (o as { idempotencyKey: string }).idempotencyKey])).toEqual([
      ['/mandir/offerings', uuid(1)],
      ['/mandir/rituals/aarti-complete', uuid(2)],
    ]);
    expect(items()).toEqual([]);
    expect(client.getQueryData<ReturnType<typeof homePayload>>(queryKeys.mandirHome)!.coins.balance).toBe(45);
  });

  it('stops (and keeps the rest) while offline or the server is busy; drops what can never succeed', async () => {
    const client = createTestQueryClient();
    resetOfflineQueue([offering(1), offering(2)]);
    api.mockRejectedValueOnce(new ApiError(0, 'NETWORK_ERROR', 'offline'));
    await flushOfflineQueue(client, TODAY);
    expect(items()).toHaveLength(2);
    expect(api).toHaveBeenCalledTimes(1);

    api.mockRejectedValueOnce(new ApiError(404, 'ITEM_NOT_AVAILABLE', 'gone')).mockResolvedValueOnce(offeringResponse());
    await flushOfflineQueue(client, TODAY);
    expect(items()).toEqual([]);

    expect(afterFailure(new ApiError(429, 'RATE_LIMITED', 'slow'))).toBe('keep');
    expect(afterFailure(new ApiError(503, 'INTERNAL', 'down'))).toBe('keep');
    expect(afterFailure(new ApiError(403, 'FEATURE_DISABLED', 'off'))).toBe('drop');
  });

  it('drops actions of an earlier day instead of counting them today', async () => {
    resetOfflineQueue([offering(1, '2026-09-28'), offering(2)]);
    api.mockResolvedValue(offeringResponse());
    await flushOfflineQueue(createTestQueryClient(), TODAY);
    expect(api).toHaveBeenCalledTimes(1);
    expect((api.mock.calls[0][1] as { idempotencyKey: string }).idempotencyKey).toBe(uuid(2));
  });

  it('never sends twice at the same time', async () => {
    resetOfflineQueue([offering(1)]);
    let answer!: (v: unknown) => void;
    api.mockImplementation((() => new Promise((r) => (answer = r))) as never);
    const client = createTestQueryClient();
    const a = flushOfflineQueue(client, TODAY);
    const b = flushOfflineQueue(client, TODAY);
    answer(offeringResponse());
    await Promise.all([a, b]);
    expect(api).toHaveBeenCalledTimes(1);
  });
});
