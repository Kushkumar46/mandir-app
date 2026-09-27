import { Global, Module } from '@nestjs/common';

import { IdempotencyInterceptor } from './idempotency.interceptor.js';
import { IDEMPOTENCY_STORE, RedisIdempotencyStore } from './idempotency.store.js';

@Global()
@Module({
  providers: [{ provide: IDEMPOTENCY_STORE, useClass: RedisIdempotencyStore }, IdempotencyInterceptor],
  exports: [IDEMPOTENCY_STORE, IdempotencyInterceptor],
})
export class IdempotencyModule {}
