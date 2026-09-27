import { addDays } from '../../core/time/local-date.js';

export interface StreakSummary {
  current: number;
  longest: number;
  doneToday: boolean;
}

/**
 * What the user sees on `localDate` (§6.3). A streak whose last darshan day is before yesterday
 * is already broken, so it shows 0 even though the row keeps the old value until the next darshan.
 */
export function streakSummary(
  row: { current: number; longest: number; lastDate: string | null } | null,
  localDate: string,
): StreakSummary {
  if (!row) return { current: 0, longest: 0, doneToday: false };
  const doneToday = row.lastDate === localDate;
  const alive = doneToday || row.lastDate === addDays(localDate, -1);
  return { current: alive ? row.current : 0, longest: row.longest, doneToday };
}
