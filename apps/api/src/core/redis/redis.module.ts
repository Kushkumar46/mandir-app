import { Global, Inject, Injectable, Module, type OnModuleDestroy } from '@nestjs/common';
import { Redis } from 'ioredis';

import { AppConfigService } from '../config/config.module.js';

export const REDIS = Symbol('REDIS');

/** Shared ioredis connection for cache and idempotency (BullMQ opens its own). */
@Injectable()
class RedisShutdown implements OnModuleDestroy {
  constructor(@Inject(REDIS) private readonly redis: Redis) {}

  async onModuleDestroy(): Promise<void> {
    await this.redis.quit();
  }
}

@Global()
@Module({
  providers: [
    {
      provide: REDIS,
      inject: [AppConfigService],
      useFactory: (config: AppConfigService) =>
        new Redis(config.env.REDIS_URL, { maxRetriesPerRequest: 3 }),
    },
    RedisShutdown,
  ],
  exports: [REDIS],
})
export class RedisModule {}
