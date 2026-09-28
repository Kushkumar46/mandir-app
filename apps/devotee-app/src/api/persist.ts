import type { QueryClient, QueryKey } from '@tanstack/react-query';

import { env } from '@/lib/env';
import { readJsonFile, writeJsonFile } from '@/lib/storage';

/**
 * Offline cache of server data (docs/modules/01-virtual-mandir.md §2 VM-01 "Offline", T14): the
 * last successful answers of the queries below are saved to one JSON file and put back into the
 * QueryClient at launch, so a cold start without internet shows the last mandir (config/flags,
 * home, offerings, aartis, thalis). Cached data is shown at once and refetched as usual; the server
 * stays the authority (e.g. the coin balance shown offline is the last one the server sent).
 */

const FILE_NAME = 'query-cache.json';
const VERSION = 1;
/** Older snapshots are dropped (a week without opening the app online). */
export const PERSIST_MAX_AGE_MS = 7 * 24 * 60 * 60_000;
const WRITE_DELAY_MS = 1000;

/** First element of the query keys that are saved (see `queryKeys`). Lyrics have their own file cache. */
const PERSISTED_ROOTS = new Set(['config', 'mandir', 'deities', 'offerings', 'aartis']);

export function isPersistedKey(key: QueryKey): boolean {
  return typeof key[0] === 'string' && PERSISTED_ROOTS.has(key[0]);
}

type Entry = { key: QueryKey; data: unknown; updatedAt: number };
type Snapshot = { v: number; buster: string; savedAt: number; entries: Entry[] };

/** A snapshot belongs to one app version, server and (dev) user; anything else starts empty. */
export function cacheBuster(): string {
  return [env.appVersion, env.apiUrl, env.devUser ?? ''].join('|');
}

export type SnapshotStorage = { read: () => unknown; write: (value: unknown) => void };
const fileStorage: SnapshotStorage = { read: () => readJsonFile(FILE_NAME), write: (v) => writeJsonFile(FILE_NAME, v) };

/** Puts the saved answers back into `client` (keeping their original fetch time, so they refetch when stale). */
export function hydrateQueryCache(
  client: QueryClient,
  { storage = fileStorage, buster = cacheBuster(), now = Date.now() }: { storage?: SnapshotStorage; buster?: string; now?: number } = {},
): number {
  const snap = storage.read() as Partial<Snapshot> | undefined;
  if (!snap || snap.v !== VERSION || snap.buster !== buster || !Array.isArray(snap.entries)) return 0;
  if (typeof snap.savedAt !== 'number' || now - snap.savedAt > PERSIST_MAX_AGE_MS) return 0;
  let restored = 0;
  for (const e of snap.entries) {
    if (!Array.isArray(e?.key) || !isPersistedKey(e.key) || e.data === undefined) continue;
    client.setQueryData(e.key, e.data, { updatedAt: e.updatedAt });
    restored++;
  }
  return restored;
}

/** The successful answers worth saving, right now. */
export function snapshotOf(client: QueryClient, buster: string, now: number): Snapshot {
  const entries: Entry[] = client
    .getQueryCache()
    .getAll()
    .filter((q) => isPersistedKey(q.queryKey) && q.state.data !== undefined)
    .map((q) => ({ key: q.queryKey, data: q.state.data, updatedAt: q.state.dataUpdatedAt }));
  return { v: VERSION, buster, savedAt: now, entries };
}

/** Saves the cache (debounced) whenever a saved query's data changes. Returns the unsubscribe. */
export function persistQueryCache(
  client: QueryClient,
  { storage = fileStorage, buster = cacheBuster() }: { storage?: SnapshotStorage; buster?: string } = {},
): () => void {
  let timer: ReturnType<typeof setTimeout> | null = null;
  const unsubscribe = client.getQueryCache().subscribe((event) => {
    if (event.type !== 'updated' || event.action.type !== 'success' || !isPersistedKey(event.query.queryKey)) return;
    if (timer) return;
    timer = setTimeout(() => {
      timer = null;
      storage.write(snapshotOf(client, buster, Date.now()));
    }, WRITE_DELAY_MS);
  });
  return () => {
    if (timer) clearTimeout(timer);
    unsubscribe();
  };
}
