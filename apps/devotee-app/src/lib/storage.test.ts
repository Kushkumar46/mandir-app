import { getPreference, resetPreferencesCache, setPreference } from './storage';

describe('device preferences', () => {
  it('returns the fallback until a value is saved, and survives a restart', () => {
    expect(getPreference('test.key', 'none')).toBe('none');
    setPreference('test.key', '2026-09-29');
    expect(getPreference('test.key', 'none')).toBe('2026-09-29');

    resetPreferencesCache(); // "app restart": read back from the file
    expect(getPreference('test.key', 'none')).toBe('2026-09-29');
  });
});
