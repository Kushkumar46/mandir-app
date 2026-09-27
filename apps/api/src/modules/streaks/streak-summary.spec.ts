import { streakSummary } from './streak-summary.js';

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
