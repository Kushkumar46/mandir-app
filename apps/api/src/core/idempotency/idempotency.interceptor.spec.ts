import type { CallHandler, ExecutionContext } from '@nestjs/common';
import { lastValueFrom, of, throwError } from 'rxjs';

import { IdempotencyInterceptor } from './idempotency.interceptor.js';
import type { IdempotencyRecord, IdempotencyStore, InProgress, StoredResponse } from './idempotency.store.js';

class MemoryStore implements IdempotencyStore {
  readonly data = new Map<string, IdempotencyRecord>();
  async claim(key: string, record: InProgress) {
    if (this.data.has(key)) return false;
    this.data.set(key, record);
    return true;
  }
  async get(key: string) {
    return this.data.get(key) ?? null;
  }
  async save(key: string, record: StoredResponse) {
    this.data.set(key, record);
  }
  async release(key: string) {
    this.data.delete(key);
  }
}

const KEY = '3f1c2b1e-8a4d-4c1e-9f7a-2b3c4d5e6f70';

function ctx(headers: Record<string, string>, body: unknown = { itemId: 'a' }) {
  const res = { statusCode: 201, status: vi.fn(), setHeader: vi.fn() };
  const req = {
    method: 'POST',
    path: '/v1/mandir/offerings',
    route: { path: '/v1/mandir/offerings' },
    body,
    user: { id: 'u1' },
    header: (n: string) => headers[n.toLowerCase()],
  };
  const context = {
    switchToHttp: () => ({ getRequest: () => req, getResponse: () => res }),
  } as unknown as ExecutionContext;
  return { context, res };
}

const handler = (fn: () => unknown): CallHandler & { calls: number } => {
  const h = {
    calls: 0,
    handle: () => {
      h.calls++;
      return of(fn());
    },
  };
  return h;
};

async function run(interceptor: IdempotencyInterceptor, context: ExecutionContext, next: CallHandler) {
  const result = await lastValueFrom(interceptor.intercept(context, next));
  return result;
}

describe('IdempotencyInterceptor', () => {
  it('requires a UUID Idempotency-Key', () => {
    const i = new IdempotencyInterceptor(new MemoryStore());
    expect(() => i.intercept(ctx({}).context, handler(() => 1))).toThrow(/required/);
    expect(() => i.intercept(ctx({ 'idempotency-key': 'nope' }).context, handler(() => 1))).toThrow(/UUID/);
  });

  it('replays the stored response for a repeated key without re-running the handler', async () => {
    const i = new IdempotencyInterceptor(new MemoryStore());
    let n = 0;
    const next = handler(() => ({ balance: 45, n: ++n }));

    const first = await run(i, ctx({ 'idempotency-key': KEY }).context, next);
    const { context, res } = ctx({ 'idempotency-key': KEY });
    const second = await run(i, context, next);

    expect(second).toEqual(first);
    expect(next.calls).toBe(1);
    expect(res.setHeader).toHaveBeenCalledWith('Idempotent-Replayed', 'true');
  });

  it('rejects reuse of a key with a different body', async () => {
    const i = new IdempotencyInterceptor(new MemoryStore());
    await run(i, ctx({ 'idempotency-key': KEY }).context, handler(() => 1));
    await expect(
      run(i, ctx({ 'idempotency-key': KEY }, { itemId: 'b' }).context, handler(() => 2)),
    ).rejects.toThrow(/different request body/);
  });

  it('rejects a concurrent duplicate while the first is in progress', async () => {
    const store = new MemoryStore();
    await store.claim(`idem:u1:POST:/v1/mandir/offerings:${KEY}`, {
      status: 'in_progress',
      requestHash: 'x',
    });
    const i = new IdempotencyInterceptor(store);
    await expect(run(i, ctx({ 'idempotency-key': KEY }).context, handler(() => 1))).rejects.toThrow(
      /still being processed/,
    );
  });

  it('releases the key when the handler fails so the client can retry', async () => {
    const store = new MemoryStore();
    const i = new IdempotencyInterceptor(store);
    const failing: CallHandler = { handle: () => throwError(() => new Error('boom')) };
    await expect(run(i, ctx({ 'idempotency-key': KEY }).context, failing)).rejects.toThrow('boom');
    expect(store.data.size).toBe(0);
    await expect(run(i, ctx({ 'idempotency-key': KEY }).context, handler(() => 'ok'))).resolves.toBe('ok');
  });
});
