import {
  aartiCompleteResponseSchema,
  type AartiCompleteRequest,
  type MakeOfferingRequest,
  makeOfferingResponseSchema,
  type MandirHome,
  type OfferingKind,
  type TodayOfferings,
} from '@mandir/shared-types';
import type { QueryClient } from '@tanstack/react-query';
import { create } from 'zustand';

import { ApiError, apiRequest } from '@/api/client';
import { noteRequestResult } from '@/api/connectivity';
import { queryKeys } from '@/api/keys';
import { applyDarshanOutcomeToHome, applyOfferingToHome } from '@/api/mandir';
import { readJsonFile, writeJsonFile } from '@/lib/storage';

/**
 * Offline queue (T14, AC "free offerings (queued)"): free offerings and aarti completions made
 * without internet are saved on the device and sent later with their original Idempotency-Key, so a
 * replay can never count twice. Nothing that spends coins is ever queued (paid offerings and unlocks
 * need the server's answer first). Actions of an earlier local day are dropped instead of sent — the
 * server would count them for the day they arrive, not the day they were made.
 */

export type QueuedAction =
  | { kind: 'offering'; key: string; localDate: string; createdAt: number; body: MakeOfferingRequest; offeringKind: OfferingKind }
  | { kind: 'aarti'; key: string; localDate: string; createdAt: number; body: AartiCompleteRequest };

const FILE_NAME = 'offline-queue.json';
/** The offering throttle is 60/min (§6.5); more queued offerings than that are dropped. */
export const OFFLINE_QUEUE_MAX = 60;

type QueueState = { items: QueuedAction[] };

function load(): QueuedAction[] {
  const saved = readJsonFile(FILE_NAME);
  return Array.isArray(saved) ? (saved as QueuedAction[]) : [];
}

export const useOfflineQueueStore = create<QueueState>(() => ({ items: load() }));

function save(items: QueuedAction[]) {
  useOfflineQueueStore.setState({ items });
  writeJsonFile(FILE_NAME, items);
}

/** "YYYY-MM-DD" of the device's local day. */
export function deviceLocalDate(now: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

export function enqueue(action: QueuedAction) {
  const items = useOfflineQueueStore.getState().items;
  if (items.some((i) => i.key === action.key)) return;
  if (action.kind === 'offering' && items.filter((i) => i.kind === 'offering').length >= OFFLINE_QUEUE_MAX) return;
  save([...items, action]);
}

/**
 * Today's offerings as the feet area shows them after a queued (not yet counted) offering — display
 * only; the server's `todayOfferings` replaces it once the offering is sent.
 */
export function bumpTodayOfferings(today: TodayOfferings, kind: OfferingKind): TodayOfferings {
  switch (kind) {
    case 'FLOWER':
      return { ...today, flowers: today.flowers + 1 };
    case 'MALA':
      return { ...today, mala: true };
    case 'DIYA':
      return { ...today, diya: true };
    case 'BHOG':
      return { ...today, bhog: true };
    default:
      return today;
  }
}

/** Queues a free offering made offline and shows it in the cached home at once. */
export function queueOffering(queryClient: QueryClient, body: MakeOfferingRequest, offeringKind: OfferingKind, key: string) {
  enqueue({ kind: 'offering', key, localDate: deviceLocalDate(), createdAt: Date.now(), body, offeringKind });
  queryClient.setQueryData<MandirHome>(queryKeys.mandirHome, (home) => {
    const today = home?.todayOfferings[body.deityId];
    return home && today ? { ...home, todayOfferings: { ...home.todayOfferings, [body.deityId]: bumpTodayOfferings(today, offeringKind) } } : home;
  });
}

export function queueAartiComplete(body: AartiCompleteRequest, key: string) {
  enqueue({ kind: 'aarti', key, localDate: deviceLocalDate(), createdAt: Date.now(), body });
}

/** What to do with a queued action after a failed send. */
export function afterFailure(e: unknown): 'keep' | 'drop' {
  if (!(e instanceof ApiError)) return 'keep';
  if (e.isNetworkError || e.status >= 500 || e.status === 429 || e.status === 408) return 'keep';
  return 'drop'; // 4xx: the item/aarti is gone, the flag is off … a replay can't succeed
}

let flushing: Promise<void> | null = null;

/**
 * Sends the queue in order, one at a time; stops at the first action that should be kept (still
 * offline / server busy). Each answer updates the cached home (balance, streak, today's offerings).
 */
export function flushOfflineQueue(queryClient: QueryClient, today: string = deviceLocalDate()): Promise<void> {
  flushing ??= (async () => {
    try {
      for (;;) {
        const next = useOfflineQueueStore.getState().items[0];
        if (!next) return;
        if (next.localDate !== today) {
          remove(next.key);
          continue;
        }
        try {
          if (next.kind === 'offering') {
            const res = await apiRequest('/mandir/offerings', {
              method: 'POST',
              body: next.body,
              schema: makeOfferingResponseSchema,
              idempotencyKey: next.key,
            });
            queryClient.setQueryData<MandirHome>(queryKeys.mandirHome, (home) => home && applyOfferingToHome(home, next.body.deityId, res));
          } else {
            const res = await apiRequest('/mandir/rituals/aarti-complete', {
              method: 'POST',
              body: next.body,
              schema: aartiCompleteResponseSchema,
              idempotencyKey: next.key,
            });
            queryClient.setQueryData<MandirHome>(queryKeys.mandirHome, (home) => home && applyDarshanOutcomeToHome(home, res));
          }
          noteRequestResult();
          remove(next.key);
        } catch (e) {
          noteRequestResult(e);
          if (afterFailure(e) === 'keep') return;
          remove(next.key);
        }
      }
    } finally {
      flushing = null;
    }
  })();
  return flushing;
}

function remove(key: string) {
  save(useOfflineQueueStore.getState().items.filter((i) => i.key !== key));
}

/** Tests only. */
export function resetOfflineQueue(items: QueuedAction[] = []) {
  save(items);
}
