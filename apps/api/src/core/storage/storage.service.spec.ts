import type { AppConfigService } from '../config/config.module.js';
import { bucketKindFor, StorageService } from './storage.service.js';

const config = {
  env: {
    S3_PUBLIC_BUCKET: 'media-public',
    S3_PRIVATE_BUCKET: 'media-private',
    CDN_BASE_URL: 'https://cdn.example.com',
    S3_REGION: 'us-east-1',
    S3_ENDPOINT: 'http://localhost:9000',
    S3_FORCE_PATH_STYLE: true,
    S3_ACCESS_KEY_ID: 'k',
    S3_SECRET_ACCESS_KEY: 's',
  },
} as unknown as AppConfigService;

describe('StorageService', () => {
  const storage = new StorageService(config);

  it('routes each prefix to the right bucket', () => {
    for (const key of ['official/a.webp', 'community/public/a.webp', 'audio/a.m4a', 'lyrics/a.json', 'themes/a.webp']) {
      expect(storage.bucketFor(key)).toBe('media-public');
    }
    for (const key of ['community/pending/a.jpg', 'home-mandir/u/a.jpg']) {
      expect(storage.bucketFor(key)).toBe('media-private');
    }
  });

  it('rejects keys without a known prefix', () => {
    expect(() => bucketKindFor('random/a.jpg')).toThrow(/no known storage prefix/);
    expect(() => bucketKindFor('community/a.jpg')).toThrow();
  });

  it('builds CDN urls only for public-bucket objects', () => {
    expect(storage.publicUrl('official/ganesh/a b.webp')).toBe(
      'https://cdn.example.com/official/ganesh/a%20b.webp',
    );
    expect(() => storage.publicUrl('community/pending/x.jpg')).toThrow(/private/);
    expect(() => storage.publicUrl('home-mandir/u/x.jpg')).toThrow(/private/);
  });

  it('presigns PUT/GET against the bucket that owns the key', async () => {
    const put = await storage.presignPut('community/pending/x.jpg', 'image/jpeg');
    expect(put).toContain('X-Amz-Signature=');
    expect(put).toContain('/media-private/community/pending/x.jpg');
    const get = await storage.presignGet('official/x.webp', 60);
    expect(get).toContain('/media-public/official/x.webp');
    expect(get).toContain('X-Amz-Expires=60');
  });

  it('copies across buckets on approval', async () => {
    const send = vi.spyOn(storage.client, 'send').mockResolvedValue({} as never);
    await storage.copy('community/pending/x.jpg', 'community/public/x.jpg');
    const input = (send.mock.calls[0]![0] as { input: Record<string, string> }).input;
    expect(input).toMatchObject({
      Bucket: 'media-public',
      CopySource: 'media-private/community/pending/x.jpg',
      Key: 'community/public/x.jpg',
    });
    send.mockRestore();
  });
});
