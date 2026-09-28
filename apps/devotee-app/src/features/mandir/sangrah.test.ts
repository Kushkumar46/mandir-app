import { applyDeityListToHome } from '@/api/mandir';
import { GANESH, HANUMAN, homePayload, SHIV, uuid } from '@/test/mandir-fixtures';

import {
  adjacentIndex,
  dragTargetIndex,
  movePositions,
  moveItem,
  orderFromPositions,
  positionsOf,
  SANGRAH_MAX,
  type SangrahEntry,
  sangrahFromHome,
  swipeDirection,
  toggleDeity,
  togglePin,
  toSetDeitiesRequest,
} from './sangrah';

const entries = (n: number): SangrahEntry[] => Array.from({ length: n }, (_, i) => ({ deityId: uuid(i + 1), isPinned: false }));

describe('toggleDeity', () => {
  it('adds at the end and removes', () => {
    const added = toggleDeity(entries(2), uuid(9));
    expect(added.error).toBeUndefined();
    expect(added.list.map((e) => e.deityId)).toEqual([uuid(1), uuid(2), uuid(9)]);
    expect(toggleDeity(added.list, uuid(1)).list.map((e) => e.deityId)).toEqual([uuid(2), uuid(9)]);
  });

  it('keeps at least one deity', () => {
    const res = toggleDeity(entries(1), uuid(1));
    expect(res.error).toBe('MIN_DEITIES');
    expect(res.list).toHaveLength(1);
  });

  it('allows at most 12 deities', () => {
    expect(toggleDeity(entries(SANGRAH_MAX - 1), uuid(99)).list).toHaveLength(SANGRAH_MAX);
    const res = toggleDeity(entries(SANGRAH_MAX), uuid(99));
    expect(res.error).toBe('MAX_DEITIES');
    expect(res.list).toHaveLength(SANGRAH_MAX);
    // removing is still possible at the limit
    expect(toggleDeity(entries(SANGRAH_MAX), uuid(1)).list).toHaveLength(SANGRAH_MAX - 1);
  });
});

describe('togglePin', () => {
  it('pins one deity at a time and unpins on a second tap', () => {
    const one = togglePin(entries(3), uuid(2));
    expect(one.map((e) => e.isPinned)).toEqual([false, true, false]);
    const other = togglePin(one, uuid(3));
    expect(other.map((e) => e.isPinned)).toEqual([false, false, true]);
    expect(togglePin(other, uuid(3)).every((e) => !e.isPinned)).toBe(true);
  });
});

describe('moveItem / toSetDeitiesRequest', () => {
  it('moves and numbers positions from 0', () => {
    const moved = moveItem(entries(4), 3, 0);
    expect(moved.map((e) => e.deityId)).toEqual([uuid(4), uuid(1), uuid(2), uuid(3)]);
    expect(toSetDeitiesRequest(moved).items.map((i) => i.position)).toEqual([0, 1, 2, 3]);
    expect(moveItem(entries(2), 0, 5)).toEqual(entries(2));
  });
});

describe('sangrahFromHome / applyDeityListToHome', () => {
  it('reads the list in position order with the pin', () => {
    const home = homePayload();
    home.deities[1]!.isPinned = true;
    home.deities.reverse();
    expect(sangrahFromHome(home)).toEqual([
      { deityId: HANUMAN, isPinned: false },
      { deityId: SHIV, isPinned: true },
      { deityId: GANESH, isPinned: false },
    ]);
  });

  it('reorders, re-pins and drops deities in the cached home', () => {
    const next = applyDeityListToHome(homePayload(), toSetDeitiesRequest([
      { deityId: GANESH, isPinned: true },
      { deityId: HANUMAN, isPinned: false },
      { deityId: uuid(77), isPinned: false }, // added: not in the cache yet
    ]));
    expect(next.deities.map((d) => [d.id, d.position, d.isPinned])).toEqual([
      [GANESH, 0, true],
      [HANUMAN, 1, false],
    ]);
  });
});

describe('deity switching', () => {
  it('wraps around', () => {
    expect(adjacentIndex(0, 3, 1)).toBe(1);
    expect(adjacentIndex(2, 3, 1)).toBe(0);
    expect(adjacentIndex(0, 3, -1)).toBe(2);
    expect(adjacentIndex(0, 1, 1)).toBe(0);
    expect(adjacentIndex(0, 0, 1)).toBe(-1);
  });

  it('turns a horizontal swipe into a direction', () => {
    expect(swipeDirection(-80, 0)).toBe(1);
    expect(swipeDirection(80, 0)).toBe(-1);
    expect(swipeDirection(-20, -900)).toBe(1); // short, fast fling
    expect(swipeDirection(30, 100)).toBeNull();
  });
});

describe('drag to reorder', () => {
  it('shifts the rows between from and to', () => {
    const ids = ['a', 'b', 'c', 'd'];
    expect(orderFromPositions(movePositions(positionsOf(ids), 0, 2))).toEqual(['b', 'c', 'a', 'd']);
    expect(orderFromPositions(movePositions(positionsOf(ids), 3, 1))).toEqual(['a', 'd', 'b', 'c']);
    expect(movePositions(positionsOf(ids), 1, 1)).toEqual(positionsOf(ids));
  });

  it('maps the dragged row top to a clamped index', () => {
    expect(dragTargetIndex(0, 64, 4)).toBe(0);
    expect(dragTargetIndex(95, 64, 4)).toBe(1);
    expect(dragTargetIndex(97, 64, 4)).toBe(2);
    expect(dragTargetIndex(-50, 64, 4)).toBe(0);
    expect(dragTargetIndex(1000, 64, 4)).toBe(3);
  });
});
