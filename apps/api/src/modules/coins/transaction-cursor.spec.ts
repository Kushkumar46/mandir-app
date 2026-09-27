import { decodeTransactionCursor, encodeTransactionCursor } from './transaction-cursor.js';

describe('transaction cursor', () => {
  it('round-trips createdAt (ms precision) and id', () => {
    const cursor = { createdAt: new Date('2026-09-27T10:11:12.345Z'), id: '3f1c2b1e-8a4d-4c1e-9f7a-2b3c4d5e6f70' };
    expect(decodeTransactionCursor(encodeTransactionCursor(cursor))).toEqual(cursor);
  });

  it.each([
    ['empty', ''],
    ['garbage', 'not-a-cursor'],
    ['bad date', Buffer.from('yesterday|abc').toString('base64url')],
    ['missing id', Buffer.from('2026-09-27T10:11:12.345Z|').toString('base64url')],
    ['extra part', Buffer.from('2026-09-27T10:11:12.345Z|a|b').toString('base64url')],
  ])('rejects %s as VALIDATION_FAILED', (_label, cursor) => {
    expect(() => decodeTransactionCursor(cursor)).toThrow(
      expect.objectContaining({ code: 'VALIDATION_FAILED' }) as unknown as Error,
    );
  });
});
