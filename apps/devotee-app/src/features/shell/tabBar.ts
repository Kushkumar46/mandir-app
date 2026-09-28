import { create } from 'zustand';

/**
 * Screens that need the whole screen (VM-06 Aarti mode) hide the bottom tab bar while they are open.
 * The tabs layout reads this store.
 */
export const useTabBarStore = create<{ hidden: boolean }>(() => ({ hidden: false }));

export function setTabBarHidden(hidden: boolean) {
  useTabBarStore.setState({ hidden });
}
