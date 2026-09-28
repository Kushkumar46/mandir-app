/**
 * Aarti thali motion (docs/modules/01-virtual-mandir.md §4.3). Pure worklet functions so the pan
 * gesture can run on the UI thread and the maths can be unit-tested.
 *
 * The thali centre moves on an ellipse around P with radii `rx`, `ry` (a circle when equal).
 * Angles are in radians, screen coordinates (y down), so increasing angle = clockwise on screen.
 */

export type Point = { x: number; y: number };
export type Radii = { rx: number; ry: number };

const TWO_PI = Math.PI * 2;

/** Finger → thali angle: `atan2` of the touch relative to P, normalised by the radii (so an ellipse tracks the finger). */
export function thaliAngle(touch: Point, center: Point, { rx, ry }: Radii): number {
  'worklet';
  return Math.atan2((touch.y - center.y) / ry, (touch.x - center.x) / rx);
}

/** Thali centre for an angle: `P + (rx·cos a, ry·sin a)`. */
export function thaliPosition(center: Point, { rx, ry }: Radii, angle: number): Point {
  'worklet';
  return { x: center.x + rx * Math.cos(angle), y: center.y + ry * Math.sin(angle) };
}

/** Change from `prev` to `next` unwrapped to (−π, π], so crossing ±π doesn't count as a jump. */
export function unwrapDelta(prev: number, next: number): number {
  'worklet';
  let d = next - prev;
  while (d > Math.PI) d -= TWO_PI;
  while (d <= -Math.PI) d += TWO_PI;
  return d;
}

/** Full circles in a cumulative (unwrapped) rotation, either direction; going back undoes progress. */
export function fullCircles(cumulative: number): number {
  'worklet';
  return Math.floor(Math.abs(cumulative) / TWO_PI + 1e-9);
}

/** Auto mode: one clockwise circle per 3 s (§4.3); slower under the OS "reduce motion" setting. */
export const AUTO_CIRCLE_MS = 3000;
export const AUTO_CIRCLE_MS_REDUCED_MOTION = 4500;

/** Circles made by the Auto thali in `autoMs` of Auto time (reported to the API, §7 T7 notes). */
export function autoCircles(autoMs: number, periodMs: number = AUTO_CIRCLE_MS): number {
  return Math.max(0, Math.floor(autoMs / periodMs));
}

/**
 * Flames on the thali by `flameStyle` (§4.3): "single" = one centred lamp, "pancha" = five lamps in a
 * ring. Positions are offsets from the thali centre in units of the thali size; unknown styles = single.
 */
export function thaliFlames(flameStyle: string): Point[] {
  if (flameStyle === 'pancha') {
    return [0, 1, 2, 3, 4].map((k) => {
      const a = -Math.PI / 2 + (k * TWO_PI) / 5;
      return { x: 0.26 * Math.cos(a), y: 0.26 * Math.sin(a) };
    });
  }
  return [{ x: 0, y: 0 }];
}
