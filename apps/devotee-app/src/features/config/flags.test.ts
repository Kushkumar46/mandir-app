import type { AppConfig } from '@mandir/shared-types';

import { isFlagEnabled } from './flags';

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
