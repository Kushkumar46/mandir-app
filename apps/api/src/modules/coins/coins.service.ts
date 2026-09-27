import { HttpStatus, Injectable } from '@nestjs/common';
import {
  type CoinTransaction,
  type CoinTransactionsQuery,
  type CoinWallet,
  ErrorCode,
  type PaginatedResponse,
} from '@mandir/shared-types';

import { AppException } from '../../core/errors/app.exception.js';
import { PrismaService } from '../../core/prisma/prisma.module.js';
import { paginated } from '../../core/response/response-envelope.interceptor.js';
import type { CoinTxnReason, Prisma } from '../../generated/prisma/client.js';
import { decodeTransactionCursor, encodeTransactionCursor } from './transaction-cursor.js';

/** What a coin change is for; stored on the ledger row. */
export interface CoinChange {
  reason: CoinTxnReason;
  /** "offering" | "purchase" | "reward_rule" | "admin" */
  refType?: string;
  refId?: string;
}

export interface CoinChangeResult {
  transactionId: string;
  /** Wallet balance after the change. */
  balance: number;
}

type Tx = Prisma.TransactionClient;

// Lock waits under contention count against these, so they are more generous than Prisma's defaults.
const TX_OPTIONS = { maxWait: 10_000, timeout: 15_000 };

/**
 * Server-authoritative coin wallet (docs/modules/01-virtual-mandir.md §5 Rules): every change inserts a
 * `CoinTransaction` and updates `CoinWallet` in one DB transaction, with the wallet row locked
 * (`SELECT … FOR UPDATE`). The balance never goes below 0 (also enforced by DB CHECK constraints).
 */
@Injectable()
export class CoinsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Current balance; users without a wallet row have 0. */
  async getBalance(userId: string): Promise<number> {
    const wallet = await this.prisma.coinWallet.findUnique({ where: { userId }, select: { balance: true } });
    return wallet?.balance ?? 0;
  }

  /** `GET /v1/coins/wallet` */
  async wallet(userId: string): Promise<CoinWallet> {
    return { balance: await this.getBalance(userId) };
  }

  /**
   * Adds `amount` (> 0) coins. Pass `tx` to make the credit part of a caller's transaction
   * (e.g. offering + reward in one commit); otherwise it runs in its own.
   */
  async credit(userId: string, amount: number, change: CoinChange, tx?: Tx): Promise<CoinChangeResult> {
    assertPositiveInt(amount);
    return this.inTx(tx, (t) => this.apply(t, userId, amount, change));
  }

  /**
   * Removes `amount` (> 0) coins, or throws 402 `COINS_INSUFFICIENT` `{ required, balance }` without
   * changing anything. Pass `tx` to make the debit part of a caller's transaction.
   */
  async debit(userId: string, amount: number, change: CoinChange, tx?: Tx): Promise<CoinChangeResult> {
    assertPositiveInt(amount);
    return this.inTx(tx, (t) => this.apply(t, userId, -amount, change));
  }

  /** `GET /v1/coins/transactions` — newest first. */
  async transactions(userId: string, { cursor, limit }: CoinTransactionsQuery): Promise<PaginatedResponse<CoinTransaction>> {
    const after = cursor ? decodeTransactionCursor(cursor) : null;
    const rows = await this.prisma.coinTransaction.findMany({
      where: {
        userId,
        ...(after && {
          OR: [{ createdAt: { lt: after.createdAt } }, { createdAt: after.createdAt, id: { lt: after.id } }],
        }),
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
    });
    const page = rows.slice(0, limit);
    const last = page.at(-1);
    return paginated(
      page.map((r) => ({
        id: r.id,
        amount: r.amount,
        balanceAfter: r.balanceAfter,
        reason: r.reason,
        refType: r.refType,
        refId: r.refId,
        createdAt: r.createdAt.toISOString(),
      })),
      rows.length > limit && last ? encodeTransactionCursor(last) : null,
    );
  }

  private inTx<T>(tx: Tx | undefined, fn: (tx: Tx) => Promise<T>): Promise<T> {
    return tx ? fn(tx) : this.prisma.$transaction(fn, TX_OPTIONS);
  }

  private async apply(tx: Tx, userId: string, delta: number, change: CoinChange): Promise<CoinChangeResult> {
    let balance = await lockWallet(tx, userId);
    if (balance === null) {
      if (delta < 0) throw coinsInsufficient(-delta, 0);
      // First credit: create the row, then lock it (a concurrent first credit may have won the insert).
      await tx.$executeRaw`
        INSERT INTO coin_wallets (user_id, balance, updated_at) VALUES (${userId}::uuid, 0, now())
        ON CONFLICT (user_id) DO NOTHING`;
      balance = (await lockWallet(tx, userId)) ?? 0;
    }

    const next = balance + delta;
    if (next < 0) throw coinsInsufficient(-delta, balance);

    await tx.coinWallet.update({ where: { userId }, data: { balance: next } });
    const txn = await tx.coinTransaction.create({
      data: {
        userId,
        amount: delta,
        balanceAfter: next,
        reason: change.reason,
        refType: change.refType ?? null,
        refId: change.refId ?? null,
      },
      select: { id: true },
    });
    return { transactionId: txn.id, balance: next };
  }
}

/** Locks the wallet row until the transaction ends; null when the user has no wallet yet. */
async function lockWallet(tx: Tx, userId: string): Promise<number | null> {
  const rows = await tx.$queryRaw<{ balance: number }[]>`
    SELECT balance FROM coin_wallets WHERE user_id = ${userId}::uuid FOR UPDATE`;
  return rows[0]?.balance ?? null;
}

function coinsInsufficient(required: number, balance: number): AppException {
  return new AppException(ErrorCode.COINS_INSUFFICIENT, 'Not enough coins', HttpStatus.PAYMENT_REQUIRED, {
    required,
    balance,
  });
}

function assertPositiveInt(amount: number): void {
  if (!Number.isSafeInteger(amount) || amount <= 0) {
    throw new RangeError(`Coin amount must be a positive integer, got ${amount}`);
  }
}
