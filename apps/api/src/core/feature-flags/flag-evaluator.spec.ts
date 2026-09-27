import type { FeatureFlag } from '@mandir/shared-types';

import { evaluateFlag, isFlagOn, isVersionBelow, rolloutBucket } from './flag-evaluator.js';

const flag = (over: Partial<FeatureFlag> = {}): FeatureFlag => ({
  key: 'mandir.test',
  enabled: true,
  rolloutPercent: 100,
  platforms: [],
  minAppVersion: null,
  payload: { a: 1 },
  ...over,
});

describe('flag evaluation', () => {
  it('disabled flags are off with no payload', () => {
    expect(evaluateFlag(flag({ enabled: false }), {})).toEqual({ enabled: false, payload: null });
  });

  it('enabled 100% flags are on for everyone, including anonymous', () => {
    expect(evaluateFlag(flag(), {})).toEqual({ enabled: true, payload: { a: 1 } });
  });

  it('respects platforms', () => {
    const f = flag({ platforms: ['android'] });
    expect(isFlagOn(f, { platform: 'android' })).toBe(true);
    expect(isFlagOn(f, { platform: 'ios' })).toBe(false);
    expect(isFlagOn(f, {})).toBe(false);
  });

  it('respects minAppVersion', () => {
    const f = flag({ minAppVersion: '1.2.0' });
    expect(isFlagOn(f, { appVersion: '1.1.9' })).toBe(false);
    expect(isFlagOn(f, { appVersion: '1.2.0' })).toBe(true);
    expect(isFlagOn(f, {})).toBe(true); // unknown client (e.g. admin-web)
  });

  it('rollout is deterministic and roughly proportional', () => {
    const f = flag({ rolloutPercent: 30 });
    expect(isFlagOn(f, {})).toBe(false); // anonymous never in partial rollout
    const ids = Array.from({ length: 2000 }, (_, i) => `user-${i}`);
    const on = ids.filter((userId) => isFlagOn(f, { userId })).length;
    expect(on / ids.length).toBeGreaterThan(0.25);
    expect(on / ids.length).toBeLessThan(0.35);
    expect(rolloutBucket('u1', 'k')).toBe(rolloutBucket('u1', 'k'));
    expect(isFlagOn(flag({ rolloutPercent: 0 }), { userId: 'u1' })).toBe(false);
  });

  it('isVersionBelow handles missing/odd versions', () => {
    expect(isVersionBelow('0.9', '1.0.0')).toBe(true);
    expect(isVersionBelow(undefined, '1.0.0')).toBe(false);
    expect(isVersionBelow('garbage', '1.0.0')).toBe(false);
  });
});
