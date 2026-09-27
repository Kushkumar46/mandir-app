import 'reflect-metadata';
import { randomUUID } from 'node:crypto';

import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';

import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/app.setup.js';

// Requires: pnpm dev:infra && pnpm db:migrate && pnpm db:seed, and DEV_AUTH=true in .env
describe('Virtual Mandir scaffolding (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
  });

  afterAll(async () => {
    await app?.close();
  });

  // Stubs answer 501 until their task lands (T4 routes are covered by mandir-home.e2e-spec.ts, T5 by coins-wallet.e2e-spec.ts) (flag-gated ones would answer 403 if their flag is off).
  it.each([
    ['get', '/v1/deities/x/offerings'],
    ['post', '/v1/mandir/offerings'],
    ['get', '/v1/deities/x/aartis'],
    ['post', '/v1/mandir/rituals/aarti-complete'],
    ['post', '/v1/mandir/rituals/darshan'],
    ['get', '/v1/me/streak'],
    ['get', '/v1/coins/packs'],
    ['get', '/v1/coins/reward-rules'],
  ] as const)('%s %s is registered under /v1', async (method, path) => {
    const server = request(app.getHttpServer());
    const res = await server[method](path)
      .set('X-Dev-User', 'dev-user')
      .set('Idempotency-Key', randomUUID());
    expect(res.status).not.toBe(404);
    expect(['NOT_IMPLEMENTED', 'FEATURE_DISABLED']).toContain(res.body.error.code);
  });

  it('routes require auth', async () => {
    await request(app.getHttpServer()).get('/v1/deities').expect(401);
  });
});
