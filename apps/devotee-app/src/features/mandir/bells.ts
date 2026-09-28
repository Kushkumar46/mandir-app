/**
 * Pure rules for bells and the first visit of the day (VM-01, §4.2). Kept out of components so they
 * can be unit-tested.
 */

export type BellSide = 'left' | 'right';

/** §4.2: log the bell at most once per minute (analytics, not billing). */
export const BELL_LOG_INTERVAL_MS = 60_000;

/** Returns true at most once per `intervalMs` (the first call always passes). */
export function createRateGate(intervalMs: number, now: () => number = Date.now) {
  let last = -Infinity;
  return () => {
    const t = now();
    if (t - last < intervalMs) return false;
    last = t;
    return true;
  };
}

/**
 * VM-01 "First visit of the day": the "आज का दर्शन" glow on the first visit of each local day
 * (server `today.localDate`), plus the soft shankh when the flag and the user's setting allow it.
 */
export function startupGreeting(input: {
  lastVisitDate: string | null;
  localDate: string;
  shankhFlag: boolean;
  shankhSetting: boolean;
}): { firstVisit: boolean; shankh: boolean } {
  const firstVisit = input.lastVisitDate !== input.localDate;
  return { firstVisit, shankh: firstVisit && input.shankhFlag && input.shankhSetting };
}
