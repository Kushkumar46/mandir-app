import type { AppConfig } from '@mandir/shared-types';

import { ApiError } from '@/api/client';

import { effectiveConfig, isFlagEnabled, OFFLINE_FALLBACK_CONFIG } from './flags';

const config: AppConfig = {
  flags: {
    'mandir.enabled': { enabled: true, payload: null },
    'mandir.festival_themes': { enabled: false, payload: null },
  },
  remoteConfig: { minSupportedAppVersion: '1.0.0', supportWhatsapp: null },
  forceUpdate: false,
  serverTime: '2026-09-28T00:00:00.000Z',
};

describe('isFlagEnabled', () => {
  it('reads the evaluated flag', () => {
    expect(isFlagEnabled(config, 'mandir.enabled')).toBe(true);
    expect(isFlagEnabled(config, 'mandir.festival_themes')).toBe(false);
  });

  it('treats unknown flags and missing config as off', () => {
    expect(isFlagEnabled(config, 'mandir.unknown')).toBe(false);
    expect(isFlagEnabled(undefined, 'mandir.enabled')).toBe(false);
  });
});

describe('effectiveConfig (T14 offline first launch)', () => {
  it("uses the server's (or cached) config when there is one", () => {
    expect(effectiveConfig(config, new ApiError(0, 'NETWORK_ERROR', 'offline'))).toBe(config);
  });

  it('falls back to "mandir only" without internet, never for server errors', () => {
    const fallback = effectiveConfig(undefined, new ApiError(0, 'NETWORK_ERROR', 'offline'));
    expect(fallback).toBe(OFFLINE_FALLBACK_CONFIG);
    expect(isFlagEnabled(fallback, 'mandir.enabled')).toBe(true);
    expect(isFlagEnabled(fallback, 'mandir.offerings')).toBe(false);
    expect(effectiveConfig(undefined, new ApiError(500, 'INTERNAL', 'boom'))).toBeUndefined();
    expect(effectiveConfig(undefined, null)).toBeUndefined();
  });
});
