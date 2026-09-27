import { DEFAULT_TIMEZONE } from '@mandir/shared-types';

/**
 * "Day" logic (streaks, daily limits, default deity) runs in the user's timezone
 * (docs/01-architecture.md §3). Local dates are "YYYY-MM-DD" strings.
 */

const formatters = new Map<string, Intl.DateTimeFormat>();

function formatterFor(timezone: string): Intl.DateTimeFormat {
  let f = formatters.get(timezone);
  if (!f) {
    try {
      f = new Intl.DateTimeFormat('en-CA', {
        timeZone: timezone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hourCycle: 'h23',
      });
    } catch {
      // Unknown IANA zone stored on a user: fall back to the default rather than failing requests.
      return formatterFor(DEFAULT_TIMEZONE);
    }
    formatters.set(timezone, f);
  }
  return f;
}

function wallClock(timezone: string, instant: Date) {
  const parts = Object.fromEntries(
    formatterFor(timezone)
      .formatToParts(instant)
      .map((p) => [p.type, p.value]),
  );
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour),
    minute: Number(parts.minute),
    second: Number(parts.second),
  };
}

/** The calendar date at `instant` in `timezone`. */
export function localDateIn(timezone: string, instant: Date = new Date()): string {
  const { year, month, day } = wallClock(timezone, instant);
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/** 0=Sun … 6=Sat for a "YYYY-MM-DD" date. */
export function weekdayOf(localDate: string): number {
  return new Date(`${localDate}T00:00:00Z`).getUTCDay();
}

export function addDays(localDate: string, days: number): string {
  const d = new Date(`${localDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** The UTC instant of wall-clock `hour`:00 on `localDate` in `timezone`. */
export function zonedTime(localDate: string, hour: number, timezone: string): Date {
  const guess = Date.parse(`${localDate}T${String(hour).padStart(2, '0')}:00:00Z`);
  const w = wallClock(timezone, new Date(guess));
  const offset = Date.UTC(w.year, w.month - 1, w.day, w.hour, w.minute, w.second) - guess;
  return new Date(guess - offset);
}
