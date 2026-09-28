import type { OfferingItemView, OfferingKind, TodayOfferings } from '@mandir/shared-types';
import { create } from 'zustand';

import { type OfferingAnimation, offeringAnimation } from '../offerings';

/** The offering animation on screen (one at a time; a new offering replaces it). */
export type ActiveOffering = {
  id: number;
  deityId: string;
  item: OfferingItemView;
  animation: OfferingAnimation;
  /** Today's offerings for the deity before this one (the feet area keeps them until it lands). */
  before: TodayOfferings;
};

type OfferingState = {
  /** VM-05 open for this kind. */
  sheet: OfferingKind | null;
  /** Placeholder coin sheet (VM-07 comes with T15): what the item costs and the last known balance. */
  coinsNeeded: { required: number; balance: number } | null;
  /** Paid item waiting for the server (its card shows a spinner, the sheet is locked). */
  pendingItemId: string | null;
  active: ActiveOffering | null;
  /**
   * Item last offered per deity and kind in this session: the feet area draws today's mala, diya,
   * bhog and flowers with its sprite (the server only counts them).
   */
  lastOffered: Record<string, Partial<Record<OfferingKind, OfferingItemView>>>;
  openSheet: (kind: OfferingKind) => void;
  closeSheet: () => void;
  showCoinsNeeded: (required: number, balance: number) => void;
  hideCoinsNeeded: () => void;
  setPending: (itemId: string | null) => void;
  play: (deityId: string, item: OfferingItemView, before: TodayOfferings) => void;
  /** Called when animation `id` has finished (or was cut short by a deity switch). */
  finish: (id: number) => void;
};

let nextId = 1;

export const useOfferingStore = create<OfferingState>((set, get) => ({
  sheet: null,
  coinsNeeded: null,
  pendingItemId: null,
  active: null,
  lastOffered: {},
  openSheet: (kind) => set({ sheet: kind }),
  closeSheet: () => set({ sheet: null, pendingItemId: null }),
  showCoinsNeeded: (required, balance) => set({ coinsNeeded: { required, balance } }),
  hideCoinsNeeded: () => set({ coinsNeeded: null }),
  setPending: (itemId) => set({ pendingItemId: itemId }),
  play: (deityId, item, before) =>
    set({ active: { id: nextId++, deityId, item, animation: offeringAnimation(item), before } }),
  finish: (id) => {
    const { active, lastOffered } = get();
    if (!active || active.id !== id) return;
    const { deityId, item } = active;
    set({
      active: null,
      lastOffered: { ...lastOffered, [deityId]: { ...lastOffered[deityId], [item.kind]: item } },
    });
  },
}));

export function resetOfferingStore() {
  useOfferingStore.setState({ sheet: null, coinsNeeded: null, pendingItemId: null, active: null, lastOffered: {} });
}
