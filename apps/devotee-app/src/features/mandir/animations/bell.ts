/**
 * Bell swing (docs/modules/01-virtual-mandir.md §4.2): rotation around the top pivot as a damped
 * oscillation `angle(t) = 18° · e^(−3t) · sin(12t)` for 1.5 s. Runs on the UI thread (worklet).
 */
export const BELL_SWING = { amplitudeDeg: 18, decayPerS: 3, angularFrequency: 12, durationS: 1.5 } as const;
export const BELL_SWING_MS = BELL_SWING.durationS * 1000;

/** Angle in degrees `t` seconds after the strike; 0 before the strike and once the swing is over. */
export function bellAngle(t: number): number {
  'worklet';
  if (t <= 0 || t >= BELL_SWING.durationS) return 0;
  return BELL_SWING.amplitudeDeg * Math.exp(-BELL_SWING.decayPerS * t) * Math.sin(BELL_SWING.angularFrequency * t);
}
