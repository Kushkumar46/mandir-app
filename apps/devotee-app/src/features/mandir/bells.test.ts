import { BELL_LOG_INTERVAL_MS, createRateGate, startupGreeting } from './bells';

describe('createRateGate (bell_rung at most once per minute)', () => {
  it('passes the first call, then once per interval', () => {
    let now = 1_000;
    const gate = createRateGate(BELL_LOG_INTERVAL_MS, () => now);
    expect(gate()).toBe(true);
    now += 1_000;
    expect(gate()).toBe(false);
    now += BELL_LOG_INTERVAL_MS - 1_001;
    expect(gate()).toBe(false);
    now += 1;
    expect(gate()).toBe(true);
    expect(gate()).toBe(false);
  });
});

describe('startupGreeting (VM-01 first visit of the day)', () => {
  const base = { localDate: '2026-09-29', shankhFlag: true, shankhSetting: true };

  it('greets with glow + shankh on the first visit of the day', () => {
    expect(startupGreeting({ ...base, lastVisitDate: null })).toEqual({ firstVisit: true, shankh: true });
    expect(startupGreeting({ ...base, lastVisitDate: '2026-09-28' })).toEqual({ firstVisit: true, shankh: true });
  });

  it('stays quiet on later visits the same day', () => {
    expect(startupGreeting({ ...base, lastVisitDate: '2026-09-29' })).toEqual({ firstVisit: false, shankh: false });
  });

  it('needs both the flag and the user setting for the shankh (glow still shows)', () => {
    expect(startupGreeting({ ...base, lastVisitDate: null, shankhFlag: false })).toEqual({ firstVisit: true, shankh: false });
    expect(startupGreeting({ ...base, lastVisitDate: null, shankhSetting: false })).toEqual({ firstVisit: true, shankh: false });
  });
});
