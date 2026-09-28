import { resolveApiUrl } from './env';

describe('resolveApiUrl', () => {
  it('uses API_URL when set, without a trailing slash', () => {
    expect(resolveApiUrl({ apiUrl: 'http://192.168.1.20:4000/', appEnv: 'local', hostUri: '10.0.0.5:8081' })).toBe(
      'http://192.168.1.20:4000',
    );
    expect(resolveApiUrl({ apiUrl: 'https://api.example.com', appEnv: 'production' })).toBe('https://api.example.com');
  });

  it('local dev without API_URL: uses the Metro host (the computer LAN IP) on port 4000', () => {
    expect(resolveApiUrl({ appEnv: 'local', hostUri: '192.168.0.235:8081' })).toBe('http://192.168.0.235:4000');
  });

  it('never derives the URL from Metro outside local dev', () => {
    expect(resolveApiUrl({ appEnv: 'staging', hostUri: '192.168.0.235:8081' })).toBe('http://localhost:4000');
  });

  it('falls back to localhost', () => {
    expect(resolveApiUrl({ appEnv: 'local', hostUri: null })).toBe('http://localhost:4000');
  });
});
