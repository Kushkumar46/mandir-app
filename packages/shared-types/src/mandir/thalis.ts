import { z } from 'zod';

// `GET /v1/mandir/thalis`, `POST /v1/mandir/thalis/:thaliId/unlock`, `PUT /v1/mandir/thali`
// (docs/modules/01-virtual-mandir.md §7 "Thali contract", rules §6.8). All behind `mandir.thali_designs`.

export const thaliViewSchema = z.object({
  id: z.uuid(),
  nameHi: z.string(),
  nameEn: z.string(),
  imageUrl: z.url(),
  /** "single" | "pancha" | … — flame layout preset (§4.3). */
  flameStyle: z.string(),
  /** 0 = free. */
  coinCost: z.number().int().min(0),
  /** Free designs are always unlocked. */
  unlocked: z.boolean(),
  selected: z.boolean(),
});
export type ThaliView = z.infer<typeof thaliViewSchema>;

/** `GET /v1/mandir/thalis` — active designs by sortOrder. */
export const thaliListSchema = z.object({
  /** Resolved selection (falls back to the default free thali); null only when no free design is active. */
  selectedThaliId: z.uuid().nullable(),
  items: z.array(thaliViewSchema),
});
export type ThaliList = z.infer<typeof thaliListSchema>;

/** `POST /v1/mandir/thalis/:thaliId/unlock` (Idempotency-Key required) — debits `coinCost` once. */
export const unlockThaliResponseSchema = z.object({
  thaliId: z.uuid(),
  coinsSpent: z.number().int().min(0),
  coinsBalance: z.number().int().min(0),
});
export type UnlockThaliResponse = z.infer<typeof unlockThaliResponseSchema>;

/** `PUT /v1/mandir/thali` — select a free or unlocked design. Unlocking does not auto-select. */
export const selectThaliRequestSchema = z.object({ thaliId: z.uuid() });
export type SelectThaliRequest = z.infer<typeof selectThaliRequestSchema>;

export const selectThaliResponseSchema = z.object({ selectedThaliId: z.uuid() });
export type SelectThaliResponse = z.infer<typeof selectThaliResponseSchema>;
