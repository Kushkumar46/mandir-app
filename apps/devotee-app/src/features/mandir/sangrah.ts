import type { MandirHome, SetMandirDeitiesRequest } from '@mandir/shared-types';

/**
 * Sangrah (VM-03) and deity switching (VM-02) rules as pure functions.
 * The user's mandir holds 1–12 deities (§2 VM-03), in `position` order, with at most one pinned.
 */

export const SANGRAH_MIN = 1;
export const SANGRAH_MAX = 12;

export type SangrahEntry = { deityId: string; isPinned: boolean };
export type SangrahError = 'MIN_DEITIES' | 'MAX_DEITIES';
export type SangrahResult = { list: SangrahEntry[]; error?: SangrahError };

export function sangrahFromHome(home: Pick<MandirHome, 'deities'>): SangrahEntry[] {
  return [...home.deities]
    .sort((a, b) => a.position - b.position)
    .map((d) => ({ deityId: d.id, isPinned: d.isPinned }));
}

/** Add (at the end) or remove a deity. Removing the last one or adding a 13th is refused. */
export function toggleDeity(list: readonly SangrahEntry[], deityId: string): SangrahResult {
  if (list.some((e) => e.deityId === deityId)) {
    if (list.length <= SANGRAH_MIN) return { list: [...list], error: 'MIN_DEITIES' };
    return { list: list.filter((e) => e.deityId !== deityId) };
  }
  if (list.length >= SANGRAH_MAX) return { list: [...list], error: 'MAX_DEITIES' };
  return { list: [...list, { deityId, isPinned: false }] };
}

/** Pin a deity (unpins any other); pinning the pinned one again unpins it. */
export function togglePin(list: readonly SangrahEntry[], deityId: string): SangrahEntry[] {
  const pin = !list.find((e) => e.deityId === deityId)?.isPinned;
  return list.map((e) => ({ ...e, isPinned: pin && e.deityId === deityId }));
}

export function moveItem<T>(list: readonly T[], from: number, to: number): T[] {
  const next = [...list];
  if (from === to || from < 0 || to < 0 || from >= next.length || to >= next.length) return next;
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item!);
  return next;
}

export function toSetDeitiesRequest(list: readonly SangrahEntry[]): SetMandirDeitiesRequest {
  return { items: list.map((e, position) => ({ deityId: e.deityId, position, isPinned: e.isPinned })) };
}

/** Next/previous deity for a swipe on the garbhagriha; wraps around at both ends. */
export function adjacentIndex(current: number, count: number, direction: 1 | -1): number {
  if (count <= 0) return -1;
  return (((current + direction) % count) + count) % count;
}

/** Swipe left (finger moves left) → next deity; right → previous. Null = not a swipe. */
export function swipeDirection(translationX: number, velocityX: number): 1 | -1 | null {
  const SWIPE_DISTANCE = 60;
  const SWIPE_VELOCITY = 600;
  if (Math.abs(translationX) < SWIPE_DISTANCE && Math.abs(velocityX) < SWIPE_VELOCITY) return null;
  const sign = Math.abs(translationX) >= SWIPE_DISTANCE ? translationX : velocityX;
  return sign < 0 ? 1 : -1;
}

/** Drag-to-reorder: positions (id → index) after moving the item at `from` to `to`. Runs on the UI thread. */
export function movePositions(positions: Record<string, number>, from: number, to: number): Record<string, number> {
  'worklet';
  const next: Record<string, number> = {};
  for (const id in positions) {
    const p = positions[id]!;
    if (p === from) next[id] = to;
    else if (from < to && p > from && p <= to) next[id] = p - 1;
    else if (from > to && p >= to && p < from) next[id] = p + 1;
    else next[id] = p;
  }
  return next;
}

/** Row index under a dragged row whose top is at `top`. */
export function dragTargetIndex(top: number, rowHeight: number, count: number): number {
  'worklet';
  return Math.min(count - 1, Math.max(0, Math.round(top / rowHeight)));
}

export function positionsOf(ids: readonly string[]): Record<string, number> {
  return Object.fromEntries(ids.map((id, i) => [id, i]));
}

export function orderFromPositions(positions: Record<string, number>): string[] {
  return Object.entries(positions)
    .sort(([, a], [, b]) => a - b)
    .map(([id]) => id);
}
