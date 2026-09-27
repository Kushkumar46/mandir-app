import { z } from 'zod';

import { todayOfferingsSchema } from './home';

// `GET /v1/deities/:deityId/offerings`, `POST /v1/mandir/offerings`
// (docs/modules/01-virtual-mandir.md §7 "Mandir", rules §6.3–§6.5).

export const offeringKindSchema = z.enum(['FLOWER', 'MALA', 'DIYA', 'BHOG', 'SPECIAL']);
export type OfferingKind = z.infer<typeof offeringKindSchema>;

/** One item in the offering sheet (VM-05). `coinCost` 0 = free. */
export const offeringItemViewSchema = z.object({
  id: z.uuid(),
  kind: offeringKindSchema,
  nameHi: z.string(),
  nameEn: z.string(),
  iconUrl: z.url(),
  spriteUrl: z.url(),
  /** "falling_flowers" | "mala_drop" | "diya_light" | "bhog_place" | "sindoor_tilak" … */
  animationKey: z.string(),
  particleCount: z.number().int().min(0),
  coinCost: z.number().int().min(0),
});
export type OfferingItemView = z.infer<typeof offeringItemViewSchema>;

/**
 * `GET /v1/deities/:deityId/offerings` — items valid for the deity, grouped by kind (kind order as in
 * `offeringKindSchema`, empty kinds omitted). Paid items are left out while `mandir.premium_offerings` is off.
 * Free items are unlimited (§6.5).
 */
export const deityOfferingsSchema = z.object({
  deityId: z.uuid(),
  groups: z.array(z.object({ kind: offeringKindSchema, items: z.array(offeringItemViewSchema) })),
});
export type DeityOfferings = z.infer<typeof deityOfferingsSchema>;

/** `POST /v1/mandir/offerings` (Idempotency-Key required; throttled to 60/min per user). */
export const makeOfferingRequestSchema = z.object({
  deityId: z.uuid(),
  offeringItemId: z.uuid(),
});
export type MakeOfferingRequest = z.infer<typeof makeOfferingRequestSchema>;

/** A reward rule that paid out (§6.4). */
export const rewardGrantSchema = z.object({ ruleKey: z.string(), coins: z.number().int().min(1) });
export type RewardGrant = z.infer<typeof rewardGrantSchema>;

export const makeOfferingResponseSchema = z.object({
  /** Balance after the spend and any reward. */
  coinsBalance: z.number().int().min(0),
  coinsSpent: z.number().int().min(0),
  streak: z.object({ current: z.number().int().min(0), doneToday: z.boolean() }),
  reward: rewardGrantSchema.nullable(),
  /** Today's offerings for this deity, including this one. */
  todayOfferings: todayOfferingsSchema,
});
export type MakeOfferingResponse = z.infer<typeof makeOfferingResponseSchema>;
