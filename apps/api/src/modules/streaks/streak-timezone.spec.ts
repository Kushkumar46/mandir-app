import { localDateIn } from '../../core/time/local-date.js';
import { nextStreak, type StreakRow, streakSummary } from './streak-summary.js';

// §6.3: darshan days are computed in the user's timezone. These replay darshan events (UTC instants)
// through localDateIn + nextStreak, as the offering / aarti / darshan-ping handlers do.
function replay(timezone: string, instants: string[]): StreakRow | null {
  let row: StreakRow | null = null;
  for (const iso of instants) row = nextStreak(row, localDateIn(timezone, new Date(iso)));
  return row;
}

describe('streak across timezone boundaries (§6.3)', () => {
  it('IST: 23:59 and 00:01 two minutes apart are consecutive days', () => {
    // 18:29Z = 23:59 IST on the 28th; 18:31Z = 00:01 IST on the 29th.
    expect(replay('Asia/Kolkata', ['2026-09-28T18:29:00Z', '2026-09-28T18:31:00Z'])).toEqual({
      current: 2,
      longest: 2,
      lastDate: '2026-09-29',
    });
  });

  it('IST: events on the same UTC date can fall on different local days, and vice versa', () => {
    // Same UTC day (29th), but 00:10Z = 05:40 IST on the 29th and 19:00Z = 00:30 IST on the 30th.
    expect(replay('Asia/Kolkata', ['2026-09-29T00:10:00Z', '2026-09-29T19:00:00Z'])?.current).toBe(2);
    // Different UTC days, same IST day (30th, 00:30 and 23:00 IST).
    expect(replay('Asia/Kolkata', ['2026-09-29T19:00:00Z', '2026-09-30T17:30:00Z'])?.current).toBe(1);
  });

  it('the same instants give a different streak in a different timezone', () => {
    const instants = ['2026-09-28T20:00:00Z', '2026-09-29T02:00:00Z'];
    // IST: 01:30 and 07:30 on the 29th → same day.
    expect(replay('Asia/Kolkata', instants)?.current).toBe(1);
    // Los Angeles (UTC−7 in September): 13:00 and 19:00 on the 28th → same day.
    expect(replay('America/Los_Angeles', instants)?.current).toBe(1);
    // UTC: the 28th and the 29th → consecutive days.
    expect(replay('UTC', instants)?.current).toBe(2);
  });

  it('a gap of more than one local day breaks the streak even if < 48 h apart in UTC', () => {
    // IST 00:05 on the 28th, then 23:55 IST on the 29th → consecutive (47h50m apart).
    expect(replay('Asia/Kolkata', ['2026-09-27T18:35:00Z', '2026-09-29T18:25:00Z'])?.current).toBe(2);
    // IST 23:55 on the 27th, then 00:05 IST on the 29th → gap (24h10m apart, but the 28th was skipped).
    expect(replay('Asia/Kolkata', ['2026-09-27T18:25:00Z', '2026-09-28T18:35:00Z'])).toEqual({
      current: 1,
      longest: 1,
      lastDate: '2026-09-29',
    });
  });

  it('DST: the 25-hour day (New York, 1 Nov 2026) is still one local day', () => {
    // 04:30Z = 00:30 EDT on 1 Nov; 04:30Z next day = 23:30 EST on 1 Nov → same day.
    expect(replay('America/New_York', ['2026-11-01T04:30:00Z', '2026-11-02T04:30:00Z'])?.current).toBe(1);
    // …and 05:30Z on the 2nd = 00:30 EST on 2 Nov → next day.
    expect(replay('America/New_York', ['2026-11-01T04:30:00Z', '2026-11-02T05:30:00Z'])?.current).toBe(2);
  });

  it('extreme offsets (UTC+14 / UTC−11) roll over at their own midnight', () => {
    // 10:30Z = 00:30 on the 30th in Kiritimati; 09:30Z = 23:30 on the 29th.
    expect(localDateIn('Pacific/Kiritimati', new Date('2026-09-29T10:30:00Z'))).toBe('2026-09-30');
    expect(replay('Pacific/Kiritimati', ['2026-09-29T09:30:00Z', '2026-09-29T10:30:00Z'])?.current).toBe(2);
    // 11:30Z = 00:30 on the 29th in Pago Pago (UTC−11); 10:30Z = 23:30 on the 28th.
    expect(replay('Pacific/Pago_Pago', ['2026-09-29T10:30:00Z', '2026-09-29T11:30:00Z'])?.current).toBe(2);
  });

  it('moving west after a darshan does not count the same day twice', () => {
    // Darshan at 00:30 IST on the 30th, then the user switches to Los Angeles where it is still the 29th.
    let row = nextStreak(null, localDateIn('Asia/Kolkata', new Date('2026-09-29T19:00:00Z')));
    row = nextStreak(row, localDateIn('America/Los_Angeles', new Date('2026-09-29T20:00:00Z')));
    expect(row).toEqual({ current: 1, longest: 1, lastDate: '2026-09-30' });
  });

  it('home display: broken at local midnight of the day after next, not at a UTC boundary', () => {
    const row = { current: 5, longest: 5, lastDate: '2026-09-28' };
    // 29th 23:59 IST → still alive (yesterday was a darshan day).
    expect(streakSummary(row, localDateIn('Asia/Kolkata', new Date('2026-09-29T18:29:00Z'))).current).toBe(5);
    // 30th 00:01 IST → broken.
    expect(streakSummary(row, localDateIn('Asia/Kolkata', new Date('2026-09-29T18:31:00Z'))).current).toBe(0);
  });
});
