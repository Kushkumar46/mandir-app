import 'reflect-metadata';
import { randomUUID } from 'node:crypto';

import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';

import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/app.setup.js';
import { PrismaService } from '../src/core/prisma/prisma.module.js';
import { OFFERINGS_PER_MINUTE } from '../src/modules/mandir/mandir.controller.js';

// T6 (revised): `POST /v1/mandir/offerings` is throttled per user (§6.5). Own file = own app instance,
// so the in-memory throttler counts start empty and other specs' requests don't interfere.
// Requires: pnpm dev:infra && pnpm db:migrate && pnpm db:seed, and DEV_AUTH=true in .env
describe('Mandir offerings throttle (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const createdUsers: string[] = [];

  // No Idempotency-Key: the throttle guard runs before the idempotency interceptor, so each request is
  // counted and then rejected with a cheap 400 that writes nothing.
  const post = (userId: string) => request(app.getHttpServer()).post('/v1/mandir/offerings').set('X-Dev-User', userId).send({});

  async function newUser(): Promise<string> {
    const user = await prisma.user.create({ data: { name: `T6t ${randomUUID().slice(0, 8)}`, timezone: 'Asia/Kolkata' } });
    createdUsers.push(user.id);
    return user.id;
  }

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    if (prisma) await prisma.user.deleteMany({ where: { id: { in: createdUsers } } });
    await app?.close();
  });

  it(`allows ${OFFERINGS_PER_MINUTE}/min per user, then 429 RATE_LIMITED with Retry-After; other users unaffected`, async () => {
    expect(OFFERINGS_PER_MINUTE).toBe(60);
    const userId = await newUser();
    for (let i = 0; i < OFFERINGS_PER_MINUTE; i++) {
      const res = await post(userId);
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('IDEMPOTENCY_KEY_REQUIRED');
    }

    const blocked = await post(userId).expect(429);
    expect(blocked.body.error.code).toBe('RATE_LIMITED');
    expect(Number(blocked.headers['retry-after'])).toBeGreaterThan(0);
    await post(userId).expect(429);

    const other = await newUser();
    await post(other).expect(400);
  });
});
