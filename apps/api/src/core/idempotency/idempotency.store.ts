import { Inject, Injectable } from '@nestjs/common';
import type { Redis } from 'ioredis';

import { REDIS } from '../redis/redis.module.js';

export interface StoredResponse {
  status: 'done';
  requestHash: string;
  body: unknown;
}
export interface InProgress {
  status: 'in_progress';
  requestHash: string;
}
export type IdempotencyRecord = StoredResponse | InProgress;

/** Minimal store interface so the interceptor can be unit-tested without Redis. */
export interface IdempotencyStore {
  /** Atomically create the record if absent. Returns false when the key already exists. */
  claim(key: string, record: InProgress, ttlSeconds: number): Promise<boolean>;
  get(key: string): Promise<IdempotencyRecord | null>;
  save(key: string, record: StoredResponse, ttlSeconds: number): Promise<void>;
  release(key: string): Promise<void>;
}

export const IDEMPOTENCY_STORE = Symbol('IDEMPOTENCY_STORE');

@Injectable()
export class RedisIdempotencyStore implements IdempotencyStore {
  constructor(@Inject(REDIS) private readonly redis: Redis) {}

  async claim(key: string, record: InProgress, ttlSeconds: number): Promise<boolean> {
    return (await this.redis.set(key, JSON.stringify(record), 'EX', ttlSeconds, 'NX')) === 'OK';
  }

  async get(key: string): Promise<IdempotencyRecord | null> {
    const raw = await this.redis.get(key);
    return raw ? (JSON.parse(raw) as IdempotencyRecord) : null;
  }

  async save(key: string, record: StoredResponse, ttlSeconds: number): Promise<void> {
    await this.redis.set(key, JSON.stringify(record), 'EX', ttlSeconds);
  }

  async release(key: string): Promise<void> {
    await this.redis.del(key);
  }
}
