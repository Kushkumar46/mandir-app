import 'reflect-metadata';
import { randomUUID } from 'node:crypto';

import { Body, Controller, HttpStatus, type INestApplication, Post } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { CoinTransaction } from '@mandir/shared-types';
import request from 'supertest';

import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/app.setup.js';
import { type AuthUser, CurrentUser } from '../src/core/auth/auth.decorators.js';
import { AppException } from '../src/core/errors/app.exception.js';
import { Idempotent } from '../src/core/idempotency/idempotency.interceptor.js';
import { PrismaService } from '../src/core/prisma/prisma.module.js';
import { CoinsModule } from '../src/modules/coins/coins.module.js';
import { CoinsService } from '../src/modules/coins/coins.service.js';

/** Test-only spend route: the real coin-spending routes (offerings) arrive with T6. */
@Controller('test/coins')
class CoinSpendProbeController {
  constructor(private readonly coins: CoinsService) {}

  @Post('spend')
  @Idempotent()
  spend(@CurrentUser() user: AuthUser, @Body() body: { amount: number }) {
    return this.coins.debit(user.id, body.amount, { reason: 'OFFERING', refType: 'offering', refId: 'probe' });
  }
}

// T5: coin wallet core — transactional credit/debit, idempotency, transactions API.
// Requires: pnpm dev:infra && pnpm db:migrate && pnpm db:seed, and DEV_AUTH=true in .env
describe('Coin wallet (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let coins: CoinsService;
  const createdUsers: string[] = [];

  const api = () => request(app.getHttpServer());
  const as = (userId: string) => ({
    get: (path: string) => api().get(path).set('X-Dev-User', userId),
    spend: (amount: number, key: string) =>
      api().post('/v1/test/coins/spend').set('X-Dev-User', userId).set('Idempotency-Key', key).send({ amount }),
  });

  async function newUser(startCoins = 0): Promise<string> {
    const user = await prisma.user.create({ data: { name: `T5 ${randomUUID().slice(0, 8)}`, timezone: 'Asia/Kolkata' } });
    createdUsers.push(user.id);
    if (startCoins > 0) await coins.credit(user.id, startCoins, { reason: 'ADMIN_ADJUST', refType: 'admin', refId: 'test' });
    return user.id;
  }

  const ledger = (userId: string) =>
    prisma.coinTransaction.findMany({ where: { userId }, orderBy: [{ createdAt: 'asc' }, { balanceAfter: 'desc' }] });

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule, CoinsModule],
      controllers: [CoinSpendProbeController],
    }).compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);
    coins = app.get(CoinsService);
  });

  afterAll(async () => {
    if (prisma) {
      // Ledger rows have no FK to users (§5 notes), so they are removed explicitly; wallets cascade.
      await prisma.coinTransaction.deleteMany({ where: { userId: { in: createdUsers } } });
      await prisma.user.deleteMany({ where: { id: { in: createdUsers } } });
    }
    await app?.close();
  });

  describe('credit / debit', () => {
    it('a user without a wallet has balance 0; first credit creates the wallet and a ledger row', async () => {
      const userId = await newUser();
      expect((await as(userId).get('/v1/coins/wallet').expect(200)).body).toEqual({ data: { balance: 0 } });

      const res = await coins.credit(userId, 7, { reason: 'REWARD', refType: 'reward_rule', refId: 'WELCOME_BONUS' });
      expect(res.balance).toBe(7);
      expect((await as(userId).get('/v1/coins/wallet').expect(200)).body.data.balance).toBe(7);

      const rows = await ledger(userId);
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({ id: res.transactionId, amount: 7, balanceAfter: 7, reason: 'REWARD' });
    });

    it('debit beyond the balance → 402 COINS_INSUFFICIENT { required, balance } and nothing changes', async () => {
      const userId = await newUser(3);
      await expect(coins.debit(userId, 5, { reason: 'OFFERING' })).rejects.toMatchObject({
        code: 'COINS_INSUFFICIENT',
        details: { required: 5, balance: 3 },
      });
      expect(await coins.getBalance(userId)).toBe(3);
      expect(await ledger(userId)).toHaveLength(1);

      const noWallet = await newUser();
      await expect(coins.debit(noWallet, 1, { reason: 'OFFERING' })).rejects.toMatchObject({
        code: 'COINS_INSUFFICIENT',
        details: { required: 1, balance: 0 },
      });
      expect(await prisma.coinWallet.findUnique({ where: { userId: noWallet } })).toBeNull();

      const res = await as(userId).spend(5, randomUUID()).expect(HttpStatus.PAYMENT_REQUIRED);
      expect(res.body.error).toMatchObject({ code: 'COINS_INSUFFICIENT', details: { required: 5, balance: 3 } });
    });

    it('rejects non-positive or fractional amounts', async () => {
      const userId = await newUser(5);
      for (const amount of [0, -1, 1.5]) {
        await expect(coins.credit(userId, amount, { reason: 'REWARD' })).rejects.toThrow(RangeError);
        await expect(coins.debit(userId, amount, { reason: 'OFFERING' })).rejects.toThrow(RangeError);
      }
      expect(await coins.getBalance(userId)).toBe(5);
    });

    it("joins the caller's transaction: a rollback undoes the debit and its ledger row", async () => {
      const userId = await newUser(10);
      await expect(
        prisma.$transaction(async (tx) => {
          await coins.debit(userId, 4, { reason: 'OFFERING' }, tx);
          throw new Error('offering failed later');
        }),
      ).rejects.toThrow('offering failed later');
      expect(await coins.getBalance(userId)).toBe(10);
      expect(await ledger(userId)).toHaveLength(1);
    });

    it('concurrent debits can never take the balance below 0', async () => {
      const userId = await newUser(10);
      const results = await Promise.allSettled(
        Array.from({ length: 25 }, () => coins.debit(userId, 1, { reason: 'OFFERING' })),
      );

      const ok = results.filter((r) => r.status === 'fulfilled');
      const failed = results.filter((r): r is PromiseRejectedResult => r.status === 'rejected');
      expect(ok).toHaveLength(10);
      expect(failed).toHaveLength(15);
      for (const f of failed) expect(f.reason).toBeInstanceOf(AppException);
      for (const f of failed) expect((f.reason as AppException).code).toBe('COINS_INSUFFICIENT');

      expect(await coins.getBalance(userId)).toBe(0);
      const debits = (await ledger(userId)).filter((r) => r.amount < 0);
      expect(debits).toHaveLength(10);
      // Serialised by the row lock: every intermediate balance appears exactly once.
      expect(debits.map((d) => d.balanceAfter).sort((a, b) => a - b)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
    });

    it('concurrent first credits all land (wallet created once)', async () => {
      const userId = await newUser();
      await Promise.all(Array.from({ length: 8 }, () => coins.credit(userId, 2, { reason: 'REWARD' })));
      expect(await coins.getBalance(userId)).toBe(16);
      expect((await ledger(userId)).map((r) => r.balanceAfter).sort((a, b) => a - b)).toEqual([2, 4, 6, 8, 10, 12, 14, 16]);
    });
  });

  describe('Idempotency-Key on a spend route', () => {
    it('a repeated key returns the same response and spends only once', async () => {
      const userId = await newUser(20);
      const key = randomUUID();

      const first = await as(userId).spend(5, key).expect(201);
      const second = await as(userId).spend(5, key).expect(201);

      expect(first.body.data).toMatchObject({ balance: 15 });
      expect(second.body).toEqual(first.body);
      expect(second.headers['idempotent-replayed']).toBe('true');
      expect(await coins.getBalance(userId)).toBe(15);
      expect((await ledger(userId)).filter((r) => r.amount < 0)).toHaveLength(1);

      // A new key is a new spend.
      await as(userId).spend(5, randomUUID()).expect(201);
      expect(await coins.getBalance(userId)).toBe(10);
    });

    it('concurrent requests with one key spend once', async () => {
      const userId = await newUser(20);
      const key = randomUUID();
      const responses = await Promise.all(Array.from({ length: 5 }, () => as(userId).spend(3, key)));

      // Losers either replay the stored response or see 409 IDEMPOTENCY_IN_PROGRESS while it runs.
      for (const r of responses) expect([201, 409]).toContain(r.status);
      expect(responses.filter((r) => r.status === 201).length).toBeGreaterThanOrEqual(1);
      expect(await coins.getBalance(userId)).toBe(17);
      expect((await ledger(userId)).filter((r) => r.amount < 0)).toHaveLength(1);
    });

    it('reusing a key with a different body → 422; missing key → 400', async () => {
      const userId = await newUser(20);
      const key = randomUUID();
      await as(userId).spend(2, key).expect(201);
      const res = await as(userId).spend(3, key).expect(422);
      expect(res.body.error.code).toBe('IDEMPOTENCY_KEY_INVALID');

      const missing = await api()
        .post('/v1/test/coins/spend')
        .set('X-Dev-User', userId)
        .send({ amount: 1 })
        .expect(400);
      expect(missing.body.error.code).toBe('IDEMPOTENCY_KEY_REQUIRED');
      expect(await coins.getBalance(userId)).toBe(18);
    });

    it('a failed spend (402) is not stored: the same key can be retried after topping up', async () => {
      const userId = await newUser(1);
      const key = randomUUID();
      await as(userId).spend(4, key).expect(402);
      await coins.credit(userId, 5, { reason: 'PURCHASE', refType: 'purchase', refId: 'test' });
      const res = await as(userId).spend(4, key).expect(201);
      expect(res.body.data.balance).toBe(2);
    });
  });

  describe('GET /v1/coins/transactions', () => {
    it('pages newest first with a cursor and only shows own rows', async () => {
      const userId = await newUser();
      for (const amount of [1, 2, 3, 4, 5]) await coins.credit(userId, amount, { reason: 'REWARD', refId: `r${amount}` });
      await coins.debit(userId, 6, { reason: 'OFFERING', refType: 'offering', refId: 'o1' });
      const other = await newUser(9);

      const seen: CoinTransaction[] = [];
      let cursor: string | null = null;
      let pages = 0;
      do {
        const res = await as(userId)
          .get(`/v1/coins/transactions?limit=4${cursor ? `&cursor=${cursor}` : ''}`)
          .expect(200);
        expect(Object.keys(res.body).sort()).toEqual(['data', 'nextCursor']);
        seen.push(...(res.body.data as CoinTransaction[]));
        cursor = res.body.nextCursor as string | null;
        pages++;
      } while (cursor);

      expect(pages).toBe(2);
      expect(seen.map((t) => t.amount)).toEqual([-6, 5, 4, 3, 2, 1]);
      expect(seen.map((t) => t.balanceAfter)).toEqual([9, 15, 10, 6, 3, 1]);
      expect(seen[0]).toMatchObject({ reason: 'OFFERING', refType: 'offering', refId: 'o1' });
      expect(new Set(seen.map((t) => t.id)).size).toBe(6);
      expect(seen.every((t) => !Number.isNaN(Date.parse(t.createdAt)))).toBe(true);

      const otherRes = await as(other).get('/v1/coins/transactions').expect(200);
      expect(otherRes.body.data).toHaveLength(1);
      expect(otherRes.body.nextCursor).toBeNull();
    });

    it('rejects a bad cursor or limit with 400', async () => {
      const userId = await newUser();
      expect((await as(userId).get('/v1/coins/transactions?cursor=nope').expect(400)).body.error.code).toBe(
        'VALIDATION_FAILED',
      );
      await as(userId).get('/v1/coins/transactions?limit=0').expect(400);
      await as(userId).get('/v1/coins/transactions?limit=51').expect(400);
    });

    it('requires auth', async () => {
      await api().get('/v1/coins/wallet').expect(401);
      await api().get('/v1/coins/transactions').expect(401);
    });
  });
});
