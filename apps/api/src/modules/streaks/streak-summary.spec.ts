import { monthRange, nextStreak, streakBadgesFor, streakSummary } from './streak-summary.js';

describe('nextStreak (§6.3)', () => {
  const row = (current: number, longest: number, lastDate: string | null) => ({ current, longest, lastDate });

  it('first darshan day starts at 1', () => {
    expect(nextStreak(null, '2026-09-29')).toEqual(row(1, 1, '2026-09-29'));
    expect(nextStreak(row(0, 0, null), '2026-09-29')).toEqual(row(1, 1, '2026-09-29'));
  });

  it('same day → unchanged (same object)', () => {
    const r = row(5, 12, '2026-09-29');
    expect(nextStreak(r, '2026-09-29')).toBe(r);
  });

  it('day after lastDate → +1, longest follows', () => {
    expect(nextStreak(row(5, 12, '2026-09-28'), '2026-09-29')).toEqual(row(6, 12, '2026-09-29'));
    expect(nextStreak(row(12, 12, '2026-02-28'), '2026-03-01')).toEqual(row(13, 13, '2026-03-01'));
  });

  it('gap → restarts at 1, longest kept', () => {
    expect(nextStreak(row(5, 12, '2026-09-27'), '2026-09-29')).toEqual(row(1, 12, '2026-09-29'));
  });

  it('lastDate after localDate (moved timezone) → unchanged', () => {
    const r = row(5, 12, '2026-09-30');
    expect(nextStreak(r, '2026-09-29')).toBe(r);
  });
});

describe('streakSummary', () => {
  const row = (lastDate: string | null) => ({ current: 5, longest: 12, lastDate });

  it('no row → zeros', () => {
    expect(streakSummary(null, '2026-09-29')).toEqual({ current: 0, longest: 0, doneToday: false });
  });

  it('done today / yesterday keeps the streak alive', () => {
    expect(streakSummary(row('2026-09-29'), '2026-09-29')).toEqual({ current: 5, longest: 12, doneToday: true });
    expect(streakSummary(row('2026-09-28'), '2026-09-29')).toEqual({ current: 5, longest: 12, doneToday: false });
    expect(streakSummary(row('2026-02-28'), '2026-03-01')).toMatchObject({ current: 5 });
  });

  it('older last day → broken streak shows 0, longest kept', () => {
    expect(streakSummary(row('2026-09-27'), '2026-09-29')).toEqual({ current: 0, longest: 12, doneToday: false });
  });
});

describe('streakBadgesFor', () => {
  it('badges for every threshold reached', () => {
    expect(streakBadgesFor(0)).toEqual([]);
    expect(streakBadgesFor(6)).toEqual([]);
    expect(streakBadgesFor(7)).toEqual(['STREAK_7']);
    expect(streakBadgesFor(50)).toEqual(['STREAK_7', 'STREAK_21']);
    expect(streakBadgesFor(51)).toEqual(['STREAK_7', 'STREAK_21', 'STREAK_51']);
    expect(streakBadgesFor(400)).toEqual(['STREAK_7', 'STREAK_21', 'STREAK_51', 'STREAK_108']);
  });
});

describe('monthRange', () => {
  it('first and last day, incl. February and December', () => {
    expect(monthRange('2026-09')).toEqual({ first: '2026-09-01', last: '2026-09-30' });
    expect(monthRange('2026-02')).toEqual({ first: '2026-02-01', last: '2026-02-28' });
    expect(monthRange('2028-02')).toEqual({ first: '2028-02-01', last: '2028-02-29' });
    expect(monthRange('2026-12')).toEqual({ first: '2026-12-01', last: '2026-12-31' });
  });
});
