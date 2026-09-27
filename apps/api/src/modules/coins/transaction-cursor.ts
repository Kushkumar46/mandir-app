import { ErrorCode } from '@mandir/shared-types';

import { AppException } from '../../core/errors/app.exception.js';

/** Keyset position in the ledger, ordered by (createdAt desc, id desc) — ties share a timestamp. */
export interface TransactionCursor {
  createdAt: Date;
  id: string;
}

export function encodeTransactionCursor({ createdAt, id }: TransactionCursor): string {
  return Buffer.from(`${createdAt.toISOString()}|${id}`, 'utf8').toString('base64url');
}

/** Opaque cursor from `nextCursor`; anything else is a 400. */
export function decodeTransactionCursor(cursor: string): TransactionCursor {
  const [iso, id, extra] = Buffer.from(cursor, 'base64url').toString('utf8').split('|');
  const createdAt = new Date(iso ?? '');
  if (!id || extra !== undefined || Number.isNaN(createdAt.getTime()) || createdAt.toISOString() !== iso) {
    throw new AppException(ErrorCode.VALIDATION_FAILED, 'Invalid cursor', undefined, {
      issues: [{ path: 'cursor', message: 'Invalid cursor' }],
    });
  }
  return { createdAt, id };
}
