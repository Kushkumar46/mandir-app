import { BullModule } from '@nestjs/bullmq';
import { Global, Module } from '@nestjs/common';

import { AppConfigService } from '../config/config.module.js';

/**
 * BullMQ root connection. Modules register their own queues with
 * `BullModule.registerQueue({ name: 'image.process' })` and a `@Processor` class.
 */
@Global()
@Module({
  imports: [
    BullModule.forRootAsync({
      inject: [AppConfigService],
      useFactory: (config: AppConfigService) => {
        const url = new URL(config.env.REDIS_URL);
        return {
          connection: {
            host: url.hostname,
            port: Number(url.port || 6379),
            username: url.username || undefined,
            password: url.password || undefined,
            tls: url.protocol === 'rediss:' ? {} : undefined,
          },
          defaultJobOptions: {
            attempts: 3,
            backoff: { type: 'exponential', delay: 5_000 },
            removeOnComplete: 1000,
            removeOnFail: false,
          },
        };
      },
    }),
  ],
  exports: [BullModule],
})
export class JobsModule {}
