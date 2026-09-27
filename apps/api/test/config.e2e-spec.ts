import 'reflect-metadata';

import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { appConfigSchema } from '@mandir/shared-types';
import request from 'supertest';

import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/app.setup.js';

// Requires: pnpm dev:infra && pnpm db:migrate && pnpm db:seed, and DEV_AUTH=true in .env
describe('Foundation (e2e)', () => {
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

  it('GET /v1/health', async () => {
    const res = await request(app.getHttpServer()).get('/v1/health').expect(200);
    expect(res.body.data).toMatchObject({ status: 'ok', db: 'ok', redis: 'ok' });
  });

  it('GET /v1/config works anonymously and matches the shared schema', async () => {
    const res = await request(app.getHttpServer())
      .get('/v1/config')
      .set('X-Platform', 'android')
      .set('X-App-Version', '0.9.0')
      .expect(200);
    const cfg = appConfigSchema.parse(res.body.data);
    expect(cfg.forceUpdate).toBe(true);
  });

  it('GET /v1/config accepts the DEV_AUTH header', async () => {
    await request(app.getHttpServer()).get('/v1/config').set('X-Dev-User', 'dev-user').expect(200);
  });

  it('unknown dev user gets the error envelope', async () => {
    const res = await request(app.getHttpServer())
      .get('/v1/config')
      .set('X-Dev-User', 'nobody')
      .expect(401);
    expect(res.body.error.code).toBe('UNAUTHENTICATED');
  });

  it('unknown routes return the error envelope', async () => {
    const res = await request(app.getHttpServer()).get('/v1/nope').expect(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });
});
