import { configWith, createTestQueryClient, homePayload } from '@/test/mandir-fixtures';

import { queryKeys } from './keys';
import { hydrateQueryCache, isPersistedKey, PERSIST_MAX_AGE_MS, persistQueryCache, type SnapshotStorage, snapshotOf } from './persist';

const BUSTER = '1.0.0|http://192.168.1.20:4000|dev-user';

function memoryStorage(initial?: unknown): SnapshotStorage & { value: unknown; writes: number } {
  const s = {
    value: initial,
    writes: 0,
    read: () => s.value,
    write: (v: unknown) => {
      s.value = JSON.parse(JSON.stringify(v));
      s.writes++;
    },
  };
  return s;
}

afterEach(() => jest.useRealTimers());

describe('offline query cache (T14)', () => {
  it('saves config, home, offerings, aartis and thalis — not lyrics or other data', () => {
    expect(isPersistedKey(queryKeys.config)).toBe(true);
    expect(isPersistedKey(queryKeys.mandirHome)).toBe(true);
    expect(isPersistedKey(queryKeys.thalis)).toBe(true);
    expect(isPersistedKey(queryKeys.deities)).toBe(true);
    expect(isPersistedKey(queryKeys.deityOfferings('x'))).toBe(true);
    expect(isPersistedKey(queryKeys.deityAartis('x'))).toBe(true);
    expect(isPersistedKey(queryKeys.aartiLyrics('x', 1))).toBe(false);
    expect(isPersistedKey(['me', 'streak'])).toBe(false);
  });

  it('round-trips through the snapshot, keeping the original fetch time', () => {
    const a = createTestQueryClient();
    a.setQueryData(queryKeys.config, configWith({ 'mandir.enabled': true }), { updatedAt: 1000 });
    a.setQueryData(queryKeys.mandirHome, homePayload(), { updatedAt: 2000 });
    a.setQueryData(queryKeys.aartiLyrics('x', 1), [{ t: 0, line: 'x' }]);
    const storage = memoryStorage(snapshotOf(a, BUSTER, 5000));

    const b = createTestQueryClient();
    expect(hydrateQueryCache(b, { storage, buster: BUSTER, now: 6000 })).toBe(2);
    expect(b.getQueryData(queryKeys.mandirHome)).toEqual(homePayload());
    expect(b.getQueryState(queryKeys.mandirHome)?.dataUpdatedAt).toBe(2000);
    expect(b.getQueryData(queryKeys.config)).toEqual(configWith({ 'mandir.enabled': true }));
    expect(b.getQueryData(queryKeys.aartiLyrics('x', 1))).toBeUndefined();
  });

  it('ignores a snapshot of another app version / server / user, a too old one, or garbage', () => {
    const a = createTestQueryClient();
    a.setQueryData(queryKeys.mandirHome, homePayload());
    const snap = snapshotOf(a, BUSTER, 5000);
    expect(hydrateQueryCache(createTestQueryClient(), { storage: memoryStorage(snap), buster: 'other', now: 6000 })).toBe(0);
    expect(hydrateQueryCache(createTestQueryClient(), { storage: memoryStorage(snap), buster: BUSTER, now: 5000 + PERSIST_MAX_AGE_MS + 1 })).toBe(0);
    expect(hydrateQueryCache(createTestQueryClient(), { storage: memoryStorage(undefined), buster: BUSTER })).toBe(0);
    expect(hydrateQueryCache(createTestQueryClient(), { storage: memoryStorage({ v: 1, buster: BUSTER, savedAt: 5000, entries: [{ nope: 1 }] }), buster: BUSTER, now: 6000 })).toBe(0);
  });

  it('writes (debounced) after server answers and cache updates of saved queries', () => {
    jest.useFakeTimers();
    const client = createTestQueryClient();
    const storage = memoryStorage();
    const stop = persistQueryCache(client, { storage, buster: BUSTER });

    client.setQueryData(queryKeys.mandirHome, homePayload());
    client.setQueryData(queryKeys.mandirHome, homePayload({ coins: { balance: 7 } }));
    client.setQueryData(['me', 'streak'], { current: 1 });
    expect(storage.writes).toBe(0);
    jest.advanceTimersByTime(1000);
    expect(storage.writes).toBe(1);
    const saved = storage.value as { entries: { key: unknown; data: { coins: { balance: number } } }[] };
    expect(saved.entries).toHaveLength(1);
    expect(saved.entries[0].data.coins.balance).toBe(7);

    client.setQueryData(['me', 'streak'], { current: 2 }); // not saved → no write
    jest.advanceTimersByTime(2000);
    expect(storage.writes).toBe(1);
    stop();
  });
});
