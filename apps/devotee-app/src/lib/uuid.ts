/**
 * RFC 4122 v4 UUID, e.g. for `Idempotency-Key` (the API requires a UUID). Uses the platform's
 * crypto when present; otherwise Math.random, which is enough for a per-request key's uniqueness.
 */
export function uuidV4(): string {
  const bytes = new Uint8Array(16);
  const cryptoApi = (globalThis as { crypto?: { getRandomValues?: (a: Uint8Array) => Uint8Array } }).crypto;
  if (cryptoApi?.getRandomValues) cryptoApi.getRandomValues(bytes);
  else for (let i = 0; i < 16; i++) bytes[i] = Math.floor(Math.random() * 256);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/** One key per user action: a retry of the same action must reuse it, a new tap gets a new one. */
export const newIdempotencyKey = uuidV4;
