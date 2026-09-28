import { autoCircles, fullCircles, thaliAngle, thaliFlames, thaliPosition, unwrapDelta } from './thali';

const P = { x: 180, y: 300 };
const R = { rx: 100, ry: 100 };
const TWO_PI = Math.PI * 2;

/** Walks a finger around P in `steps` equal steps (clockwise when `dir` = 1) and sums the unwrapped deltas. */
function drag(turns: number, dir: 1 | -1 = 1, steps = 36, radii = R) {
  let last = thaliAngle({ x: P.x + radii.rx, y: P.y }, P, radii);
  let cumulative = 0;
  for (let i = 1; i <= Math.round(turns * steps); i++) {
    const a = (dir * i * TWO_PI) / steps;
    const touch = { x: P.x + radii.rx * 1.3 * Math.cos(a), y: P.y + radii.ry * 1.3 * Math.sin(a) };
    const next = thaliAngle(touch, P, radii);
    cumulative += unwrapDelta(last, next);
    last = next;
  }
  return cumulative;
}

describe('§4.3 thali geometry', () => {
  it('follows the finger angle around P and sits on the circle of radius R', () => {
    const a = thaliAngle({ x: P.x, y: P.y + 40 }, P, R); // straight below P, any distance
    expect(a).toBeCloseTo(Math.PI / 2);
    const below = thaliPosition(P, R, a);
    expect(below.x).toBeCloseTo(180);
    expect(below.y).toBeCloseTo(400);
    expect(thaliPosition(P, R, 0)).toEqual({ x: 280, y: 300 });
  });

  it('tracks an ellipse by normalising with the radii', () => {
    const ellipse = { rx: 100, ry: 50 };
    const a = thaliAngle({ x: P.x + 100, y: P.y + 50 }, P, ellipse);
    expect(a).toBeCloseTo(Math.PI / 4);
    const pos = thaliPosition(P, ellipse, a);
    expect(pos.x - P.x).toBeCloseTo(100 * Math.SQRT1_2);
    expect(pos.y - P.y).toBeCloseTo(50 * Math.SQRT1_2);
  });

  it('unwraps deltas across ±π', () => {
    expect(unwrapDelta(Math.PI - 0.1, -Math.PI + 0.1)).toBeCloseTo(0.2);
    expect(unwrapDelta(-Math.PI + 0.1, Math.PI - 0.1)).toBeCloseTo(-0.2);
    expect(unwrapDelta(0, 0.5)).toBeCloseTo(0.5);
    expect(unwrapDelta(1, 1)).toBe(0);
  });
});

describe('§4.3 circle counting', () => {
  it('counts full circles in either direction', () => {
    expect(fullCircles(drag(3))).toBe(3);
    expect(fullCircles(drag(3, -1))).toBe(3);
    expect(fullCircles(drag(2.9))).toBe(2);
    expect(fullCircles(drag(3, 1, 36, { rx: 100, ry: 40 }))).toBe(3);
  });

  it('does not count wiggling back and forth', () => {
    let cumulative = 0;
    for (let i = 0; i < 50; i++) cumulative += i % 2 ? 0.8 : -0.8;
    expect(fullCircles(cumulative)).toBe(0);
  });

  it('going back undoes progress', () => {
    expect(fullCircles(drag(2) + drag(1, -1))).toBe(1);
  });

  it('auto makes one circle per period', () => {
    expect(autoCircles(0)).toBe(0);
    expect(autoCircles(2999)).toBe(0);
    expect(autoCircles(9000)).toBe(3);
    expect(autoCircles(9000, 4500)).toBe(2);
    expect(autoCircles(-5)).toBe(0);
  });
});

describe('thali flames', () => {
  it('single = one centred lamp, pancha = five in a ring, unknown = single', () => {
    expect(thaliFlames('single')).toEqual([{ x: 0, y: 0 }]);
    expect(thaliFlames('mystery')).toEqual([{ x: 0, y: 0 }]);
    const five = thaliFlames('pancha');
    expect(five).toHaveLength(5);
    for (const f of five) expect(Math.hypot(f.x, f.y)).toBeCloseTo(0.26);
    expect(five[0].x).toBeCloseTo(0); // top lamp first
  });
});
