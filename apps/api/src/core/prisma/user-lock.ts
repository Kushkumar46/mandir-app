import type { Prisma } from '../../generated/prisma/client.js';

/**
 * Serialises a user's check-then-write flows (daily limits, reward caps, streak updates) for the rest
 * of the transaction, using a Postgres transaction-level advisory lock. Re-entrant within one
 * transaction. Take it before any row lock (e.g. the coin wallet's `FOR UPDATE`) so lock order stays
 * the same everywhere.
 */
export async function lockUser(tx: Prisma.TransactionClient, userId: string): Promise<void> {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`user:${userId}`}, 0))`;
}
