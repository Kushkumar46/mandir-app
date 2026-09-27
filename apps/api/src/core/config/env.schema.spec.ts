import { parseEnv } from './env.schema.js';

const base = {
  DATABASE_URL: 'postgresql://u:p@localhost:5432/db',
  REDIS_URL: 'redis://localhost:6379',
  S3_ACCESS_KEY_ID: 'k',
  S3_SECRET_ACCESS_KEY: 's',
  S3_PUBLIC_BUCKET: 'media-public',
  S3_PRIVATE_BUCKET: 'media-private',
  CDN_BASE_URL: 'http://localhost:9000/media-public/',
};

describe('parseEnv', () => {
  it('applies defaults and normalises values', () => {
    const env = parseEnv({ ...base, CORS_ORIGINS: 'http://a.test, http://b.test' });
    expect(env.PORT).toBe(4000);
    expect(env.DEV_AUTH).toBe(false);
    expect(env.CDN_BASE_URL).toBe('http://localhost:9000/media-public');
    expect(env.CORS_ORIGINS).toEqual(['http://a.test', 'http://b.test']);
  });

  it('refuses DEV_AUTH in production', () => {
    expect(() => parseEnv({ ...base, NODE_ENV: 'production', DEV_AUTH: 'true' })).toThrow(
      /DEV_AUTH must never be enabled in production/,
    );
    expect(() => parseEnv({ ...base, APP_ENV: 'production', DEV_AUTH: 'true' })).toThrow();
  });

  it('requires two different buckets', () => {
    expect(() => parseEnv({ ...base, S3_PRIVATE_BUCKET: 'media-public' })).toThrow(/must be different/);
  });

  it('lists missing variables', () => {
    expect(() => parseEnv({})).toThrow(/DATABASE_URL/);
  });
});
