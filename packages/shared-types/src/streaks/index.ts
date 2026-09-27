import { z } from 'zod';

// Streak + badges API contracts (`GET /v1/me/streak`, docs/modules/01-virtual-mandir.md §6.3, §7 "T7 contract notes").

/** Streak lengths that earn a badge (and pay the reward rule of the same key, §6.4). */
export const STREAK_BADGE_DAYS = [7, 21, 51, 108] as const;

export const badgeKeySchema = z.enum(['STREAK_7', 'STREAK_21', 'STREAK_51', 'STREAK_108', 'DARSHAN_SEVAK', 'TIRTH_YATRI']);
export type BadgeKey = z.infer<typeof badgeKeySchema>;

export const streakBadgeKey = (days: (typeof STREAK_BADGE_DAYS)[number]) => `STREAK_${days}` as BadgeKey;

/** Streak as the user sees it today: `current` is 0 once the streak is broken. */
export const streakStateSchema = z.object({
  current: z.number().int().min(0),
  longest: z.number().int().min(0),
  doneToday: z.boolean(),
});
export type StreakState = z.infer<typeof streakStateSchema>;

const monthSchema = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Use YYYY-MM');

/** `GET /v1/me/streak?month=YYYY-MM` — default is the user's current local month. */
export const streakQuerySchema = z.object({ month: monthSchema.optional() });
export type StreakQuery = z.infer<typeof streakQuerySchema>;

export const earnedBadgeSchema = z.object({ key: badgeKeySchema, earnedAt: z.iso.datetime() });
export type EarnedBadge = z.infer<typeof earnedBadgeSchema>;

export const streakDetailsSchema = streakStateSchema.extend({
  /** Oldest first. */
  badges: z.array(earnedBadgeSchema),
  calendar: z.object({
    month: monthSchema,
    /** Local dates ("YYYY-MM-DD") in `month` that counted as darshan days, ascending. */
    days: z.array(z.string()),
  }),
});
export type StreakDetails = z.infer<typeof streakDetailsSchema>;
