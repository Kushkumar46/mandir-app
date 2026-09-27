import { addDays, localDateIn, weekdayOf, zonedTime } from './local-date.js';

describe('local-date', () => {
  it('uses the user timezone at day boundaries', () => {
    // 2026-09-28T18:29Z = 23:59 IST on the 28th; one minute later it is the 29th in India.
    expect(localDateIn('Asia/Kolkata', new Date('2026-09-28T18:29:00Z'))).toBe('2026-09-28');
    expect(localDateIn('Asia/Kolkata', new Date('2026-09-28T18:30:00Z'))).toBe('2026-09-29');
    expect(localDateIn('America/New_York', new Date('2026-09-29T03:00:00Z'))).toBe('2026-09-28');
  });

  it('falls back to the default timezone for unknown zones', () => {
    expect(localDateIn('Not/AZone', new Date('2026-09-28T18:30:00Z'))).toBe('2026-09-29');
  });

  it('weekdayOf and addDays', () => {
    expect(weekdayOf('2026-09-27')).toBe(0);
    expect(weekdayOf('2026-09-29')).toBe(2);
    expect(addDays('2026-02-28', 1)).toBe('2026-03-01');
    expect(addDays('2026-01-01', -1)).toBe('2025-12-31');
  });

  it('zonedTime converts local wall-clock time to UTC', () => {
    expect(zonedTime('2026-09-29', 6, 'Asia/Kolkata').toISOString()).toBe('2026-09-29T00:30:00.000Z');
    expect(zonedTime('2026-07-01', 6, 'America/New_York').toISOString()).toBe('2026-07-01T10:00:00.000Z');
  });
});
