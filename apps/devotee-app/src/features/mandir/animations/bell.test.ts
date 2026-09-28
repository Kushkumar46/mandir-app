import { BELL_SWING, bellAngle } from './bell';

describe('bell swing (§4.2)', () => {
  it('follows 18° · e^(−3t) · sin(12t)', () => {
    for (const t of [0.05, 0.13, 0.4, 0.77, 1.2]) {
      expect(bellAngle(t)).toBeCloseTo(18 * Math.exp(-3 * t) * Math.sin(12 * t), 10);
    }
  });

  it('is at rest before the strike and after 1.5 s', () => {
    expect(bellAngle(0)).toBe(0);
    expect(bellAngle(-1)).toBe(0);
    expect(bellAngle(BELL_SWING.durationS)).toBe(0);
    expect(bellAngle(5)).toBe(0);
  });

  it('never exceeds 18° and dies down', () => {
    const samples = Array.from({ length: 150 }, (_, i) => Math.abs(bellAngle(i / 100)));
    expect(Math.max(...samples)).toBeLessThanOrEqual(18);
    expect(Math.max(...samples.slice(0, 30))).toBeGreaterThan(10); // a real swing at the start
    expect(Math.max(...samples.slice(120))).toBeLessThan(0.5); // almost still at the end
  });
});
