import {
  CopyObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Global, Injectable, Module } from '@nestjs/common';

import { AppConfigService } from '../config/config.module.js';

/**
 * Object key prefixes (docs/01-architecture.md §6). Every objectKey starts with one of these;
 * the prefix decides the bucket, so callers never deal with bucket names.
 */
export const StoragePrefix = {
  // media-public — public read via CDN
  OFFICIAL: 'official/',
  COMMUNITY_PUBLIC: 'community/public/',
  AUDIO: 'audio/',
  LYRICS: 'lyrics/',
  THEMES: 'themes/',
  // media-private — signed URLs only
  COMMUNITY_PENDING: 'community/pending/',
  HOME_MANDIR: 'home-mandir/',
} as const;
export type StoragePrefix = (typeof StoragePrefix)[keyof typeof StoragePrefix];

export type BucketKind = 'public' | 'private';

const PREFIX_BUCKET: Record<StoragePrefix, BucketKind> = {
  [StoragePrefix.OFFICIAL]: 'public',
  [StoragePrefix.COMMUNITY_PUBLIC]: 'public',
  [StoragePrefix.AUDIO]: 'public',
  [StoragePrefix.LYRICS]: 'public',
  [StoragePrefix.THEMES]: 'public',
  [StoragePrefix.COMMUNITY_PENDING]: 'private',
  [StoragePrefix.HOME_MANDIR]: 'private',
};

/** Which bucket an object key lives in. Throws for keys without a known prefix. */
export function bucketKindFor(objectKey: string): BucketKind {
  const prefix = (Object.keys(PREFIX_BUCKET) as StoragePrefix[]).find((p) => objectKey.startsWith(p));
  if (!prefix) throw new Error(`Object key "${objectKey}" has no known storage prefix`);
  return PREFIX_BUCKET[prefix];
}

@Injectable()
export class StorageService {
  private readonly s3: S3Client;
  private readonly buckets: Record<BucketKind, string>;
  private readonly cdnBaseUrl: string;

  constructor(config: AppConfigService) {
    const env = config.env;
    this.buckets = { public: env.S3_PUBLIC_BUCKET, private: env.S3_PRIVATE_BUCKET };
    this.cdnBaseUrl = env.CDN_BASE_URL;
    this.s3 = new S3Client({
      region: env.S3_REGION,
      endpoint: env.S3_ENDPOINT,
      forcePathStyle: env.S3_FORCE_PATH_STYLE,
      credentials: { accessKeyId: env.S3_ACCESS_KEY_ID, secretAccessKey: env.S3_SECRET_ACCESS_KEY },
    });
  }

  /** Bucket name for an object key. */
  bucketFor(objectKey: string): string {
    return this.buckets[bucketKindFor(objectKey)];
  }

  isPublic(objectKey: string): boolean {
    return bucketKindFor(objectKey) === 'public';
  }

  /** Presigned PUT for direct client uploads. The client must send the same Content-Type. */
  presignPut(objectKey: string, contentType: string, expiresInSeconds = 600): Promise<string> {
    return getSignedUrl(
      this.s3,
      new PutObjectCommand({ Bucket: this.bucketFor(objectKey), Key: objectKey, ContentType: contentType }),
      { expiresIn: expiresInSeconds },
    );
  }

  /** Short-lived signed GET — the only way to serve private-bucket objects. */
  presignGet(objectKey: string, expiresInSeconds = 300): Promise<string> {
    return getSignedUrl(
      this.s3,
      new GetObjectCommand({ Bucket: this.bucketFor(objectKey), Key: objectKey }),
      { expiresIn: expiresInSeconds },
    );
  }

  /** CDN URL for public-bucket objects. Throws for private keys so they can never leak via the CDN. */
  publicUrl(objectKey: string): string {
    if (!this.isPublic(objectKey)) {
      throw new Error(`Refusing to build a public URL for private object "${objectKey}"`);
    }
    return `${this.cdnBaseUrl}/${objectKey.split('/').map(encodeURIComponent).join('/')}`;
  }

  /** Copies within or across buckets (e.g. approval: community/pending/ → community/public/). */
  async copy(fromKey: string, toKey: string): Promise<void> {
    await this.s3.send(
      new CopyObjectCommand({
        Bucket: this.bucketFor(toKey),
        CopySource: `${this.bucketFor(fromKey)}/${fromKey.split('/').map(encodeURIComponent).join('/')}`,
        Key: toKey,
      }),
    );
  }

  /** Server-side write (seed, generated variants). Public objects get a long immutable cache. */
  async put(objectKey: string, body: Uint8Array | string, contentType: string): Promise<void> {
    await this.s3.send(
      new PutObjectCommand({
        Bucket: this.bucketFor(objectKey),
        Key: objectKey,
        Body: body,
        ContentType: contentType,
        CacheControl: this.isPublic(objectKey) ? 'public, max-age=31536000, immutable' : 'private, no-store',
      }),
    );
  }

  async delete(objectKey: string): Promise<void> {
    await this.s3.send(new DeleteObjectCommand({ Bucket: this.bucketFor(objectKey), Key: objectKey }));
  }

  /** Raw client for jobs that need streaming reads/writes (e.g. image variants); use bucketFor(). */
  get client(): S3Client {
    return this.s3;
  }
}

@Global()
@Module({
  providers: [StorageService],
  exports: [StorageService],
})
export class StorageModule {}
