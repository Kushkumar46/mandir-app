import { create } from 'zustand';

type SelectionState = {
  /** Deity the user switched to in this session; null = the server's default deity of the day. */
  selectedDeityId: string | null;
  select: (deityId: string) => void;
};

/**
 * Session-only (not persisted): every app open starts on the default deity of the day (VM-02),
 * which the server resolves from the saved pin/order.
 */
export const useDeitySelectionStore = create<SelectionState>((set) => ({
  selectedDeityId: null,
  select: (selectedDeityId) => set({ selectedDeityId }),
}));
