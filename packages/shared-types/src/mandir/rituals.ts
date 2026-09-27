import { z } from 'zod';

import { badgeKeySchema, streakStateSchema } from '../streaks';

// `GET /v1/deities/:deityId/aartis`, `POST /v1/mandir/rituals/aarti-complete`, `POST /v1/mandir/rituals/darshan`
// (docs/modules/01-virtual-mandir.md §7 "T7 contract notes", rules §6.3 + §6.4, VM-06).

/** VM-06 completion rule: ≥ 90% of the audio played and ≥ 3 full thali circles (Auto mode reports its circles). */
export const AARTI_MIN_PLAYED_RATIO = 0.9;
export const AARTI_MIN_CIRCLES = 3;

export const aartiViewSchema = z.object({
  id: z.uuid(),
  titleHi: z.string(),
  titleEn: z.string(),
  audioUrl: z.url(),
  /** Lyrics timeline JSON: `[{ t, line }]`, t in seconds (§4.5). */
  lyricsUrl: z.url(),
  durationSec: z.number().int().min(0),
  /** Cache key on device = id + version. */
  version: z.number().int(),
  isDefault: z.boolean(),
});
export type AartiView = z.infer<typeof aartiViewSchema>;

/** `GET /v1/deities/:deityId/aartis` — active aartis, default first, then newest version. */
export const deityAartisSchema = z.object({ deityId: z.uuid(), items: z.array(aartiViewSchema) });
export type DeityAartis = z.infer<typeof deityAartisSchema>;

/** A reward rule that paid out (§6.4). */
export const rewardGrantSchema = z.object({ ruleKey: z.string(), coins: z.number().int().min(1) });
export type RewardGrant = z.infer<typeof rewardGrantSchema>;

/**
 * What every darshan-day action (offering, aarti, darshan ping) returns: streak after the action,
 * every reward paid by this request and the badges first earned by it.
 */
export const darshanOutcomeSchema = z.object({
  /** Balance after any spend and rewards. */
  coinsBalance: z.number().int().min(0),
  streak: streakStateSchema,
  rewards: z.array(rewardGrantSchema),
  badgesEarned: z.array(badgeKeySchema),
});
export type DarshanOutcome = z.infer<typeof darshanOutcomeSchema>;

/** `POST /v1/mandir/rituals/aarti-complete` (Idempotency-Key required). */
export const aartiCompleteRequestSchema = z.object({
  deityId: z.uuid(),
  aartiId: z.uuid(),
  /** Share of the audio played, 0..1. */
  playedRatio: z.number().min(0).max(1),
  /** Full thali circles, manual or Auto. */
  circles: z.number().int().min(0),
  /** Thali used (T7b); must be free or unlocked. Omitted = the user's selection. */
  thaliId: z.uuid().optional(),
});
export type AartiCompleteRequest = z.infer<typeof aartiCompleteRequestSchema>;

export const aartiCompleteResponseSchema = darshanOutcomeSchema.extend({ ritualLogId: z.uuid() });
export type AartiCompleteResponse = z.infer<typeof aartiCompleteResponseSchema>;

/** `POST /v1/mandir/rituals/darshan` — sent after `darshanPingSeconds` on VM-01 (remote config). */
export const darshanPingRequestSchema = z.object({
  deityId: z.uuid(),
  seconds: z.number().int().min(0),
});
export type DarshanPingRequest = z.infer<typeof darshanPingRequestSchema>;

export const darshanPingResponseSchema = darshanOutcomeSchema.extend({
  /** False while pings don't count for the streak (`darshanPingSeconds: null`); nothing was written. */
  counted: z.boolean(),
});
export type DarshanPingResponse = z.infer<typeof darshanPingResponseSchema>;

/** Remote config key: seconds before the darshan ping; null = pings don't count (§6.3). */
export const DARSHAN_PING_SECONDS_KEY = 'darshanPingSeconds';
export const DEFAULT_DARSHAN_PING_SECONDS = 20;
