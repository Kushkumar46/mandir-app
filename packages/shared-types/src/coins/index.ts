import { z } from 'zod';

import { paginationQuerySchema } from '../api';

// Coins API contracts (docs/modules/01-virtual-mandir.md §7 "Coins"). Packs, reward rules and the
// RevenueCat webhook are added by T15.

export const coinTxnReasonSchema = z.enum(['PURCHASE', 'OFFERING', 'REWARD', 'REFUND', 'ADMIN_ADJUST', 'UNLOCK']);
export type CoinTxnReason = z.infer<typeof coinTxnReasonSchema>;

/** `GET /v1/coins/wallet` — server-authoritative balance (0 when the user has no wallet yet). */
export const coinWalletSchema = z.object({ balance: z.number().int().min(0) });
export type CoinWallet = z.infer<typeof coinWalletSchema>;

/** One ledger row. `amount` is + for credits, − for debits. */
export const coinTransactionSchema = z.object({
  id: z.uuid(),
  amount: z.number().int(),
  balanceAfter: z.number().int().min(0),
  reason: coinTxnReasonSchema,
  /** "offering" | "purchase" | "reward_rule" | "admin" | "unlock" */
  refType: z.string().nullable(),
  refId: z.string().nullable(),
  createdAt: z.iso.datetime(),
});
export type CoinTransaction = z.infer<typeof coinTransactionSchema>;

/** `GET /v1/coins/transactions?cursor=&limit=` — newest first, paginated envelope. */
export const coinTransactionsQuerySchema = paginationQuerySchema;
export type CoinTransactionsQuery = z.infer<typeof coinTransactionsQuerySchema>;
