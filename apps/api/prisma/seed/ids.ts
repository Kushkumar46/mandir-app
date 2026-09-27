import { createHash } from 'node:crypto';

/**
 * Deterministic UUID for a seeded row (`seedId('deity:hanuman')`), so every run targets the
 * same rows and upserts stay idempotent. Formatted as a v4-style UUID from a SHA-256 hash.
 */
export function seedId(name: string): string {
  const h = createHash('sha256').update(`mandir-seed:${name}`).digest('hex');
  const variant = ((parseInt(h[16]!, 16) & 0x3) | 0x8).toString(16);
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-${variant}${h.slice(17, 20)}-${h.slice(20, 32)}`;
}
