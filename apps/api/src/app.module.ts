import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';

import { AuthGuard } from './core/auth/auth.guard.js';
import { AppConfigModule } from './core/config/config.module.js';
import { HttpExceptionFilter } from './core/errors/http-exception.filter.js';
import { FeatureFlagsModule } from './core/feature-flags/feature-flags.module.js';
import { RequireFlagGuard } from './core/feature-flags/require-flag.guard.js';
import { HealthController } from './core/health/health.controller.js';
import { IdempotencyModule } from './core/idempotency/idempotency.module.js';
import { JobsModule } from './core/jobs/jobs.module.js';
import { PrismaModule } from './core/prisma/prisma.module.js';
import { RedisModule } from './core/redis/redis.module.js';
import { ResponseEnvelopeInterceptor } from './core/response/response-envelope.interceptor.js';
import { StorageModule } from './core/storage/storage.service.js';
import { CoinsModule } from './modules/coins/coins.module.js';
import { ImagesModule } from './modules/images/images.module.js';
import { MandirModule } from './modules/mandir/mandir.module.js';
import { StreaksModule } from './modules/streaks/streaks.module.js';

@Module({
  imports: [
    AppConfigModule,
    PrismaModule,
    RedisModule,
    // Global default; modules override per route with @Throttle().
    ThrottlerModule.forRoot([{ name: 'default', ttl: 60_000, limit: 120 }]),
    JobsModule,
    StorageModule,
    IdempotencyModule,
    FeatureFlagsModule,
    // Feature modules (apps/api/src/modules/*) are added here by their build tasks.
    CoinsModule,
    ImagesModule,
    StreaksModule,
    MandirModule,
  ],
  controllers: [HealthController],
  providers: [
    // Global guards run in this order: rate limit → authenticate → feature flags.
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: AuthGuard },
    { provide: APP_GUARD, useClass: RequireFlagGuard },
    { provide: APP_INTERCEPTOR, useClass: ResponseEnvelopeInterceptor },
    { provide: APP_FILTER, useClass: HttpExceptionFilter },
  ],
})
export class AppModule {}
