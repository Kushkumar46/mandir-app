import { Controller, Get, Inject } from '@nestjs/common';
import type { Redis } from 'ioredis';

import { Public } from '../auth/auth.decorators.js';
import { PrismaService } from '../prisma/prisma.module.js';
import { REDIS } from '../redis/redis.module.js';

@Controller('health')
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(REDIS) private readonly redis: Redis,
  ) {}

  @Get()
  @Public()
  async check() {
    const [db, redis] = await Promise.all([
      this.prisma.$queryRaw`SELECT 1`.then(() => 'ok' as const).catch(() => 'down' as const),
      this.redis.ping().then(() => 'ok' as const).catch(() => 'down' as const),
    ]);
    return { status: db === 'ok' && redis === 'ok' ? 'ok' : 'degraded', db, redis };
  }
}
