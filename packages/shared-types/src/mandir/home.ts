import { z } from 'zod';

// `GET /v1/mandir/home`, `GET /v1/deities`, `PUT /v1/mandir/deities`, `PUT /v1/mandir/deities/:deityId/image`
// (docs/modules/01-virtual-mandir.md §7 "Mandir", rules §6.1 + §6.2).

export const imageSourceSchema = z.enum(['OFFICIAL', 'COMMUNITY', 'HOME_MANDIR']);
export type ImageSource = z.infer<typeof imageSourceSchema>;

export const imageStatusSchema = z.enum(['PROCESSING', 'AUTO_REJECTED', 'PENDING', 'PRIVATE', 'PUBLIC', 'REJECTED', 'REMOVED']);
export type ImageStatus = z.infer<typeof imageStatusSchema>;

export const imageVariantUrlsSchema = z.object({
  thumb: z.url(),
  card: z.url(),
  full: z.url(),
  hd: z.url(),
});
export type ImageVariantUrls = z.infer<typeof imageVariantUrlsSchema>;

/**
 * The darshan image shown for a deity (result of the §6.2 resolution). Public images get CDN URLs;
 * the owner's non-public images get short-lived signed URLs (refetch `home` when they expire).
 * `status` lets the app show the "processing" placeholder for the owner's own uploads.
 */
export const deityImageViewSchema = z.object({
  id: z.uuid(),
  source: imageSourceSchema,
  status: imageStatusSchema,
  urls: imageVariantUrlsSchema,
  /** Mala anchor, 0..1 of width/height. Null = app default. */
  anchor: z.object({ x: z.number(), y: z.number() }).nullable(),
  credit: z.object({ name: z.string().nullable(), temple: z.string().nullable() }).nullable(),
});
export type DeityImageView = z.infer<typeof deityImageViewSchema>;

/** Offerings done today for one deity (drives pile stages / lit diya etc.). */
export const todayOfferingsSchema = z.object({
  flowers: z.number().int().min(0),
  mala: z.boolean(),
  diya: z.boolean(),
  bhog: z.boolean(),
});
export type TodayOfferings = z.infer<typeof todayOfferingsSchema>;

export const homeDeitySchema = z.object({
  id: z.uuid(),
  slug: z.string(),
  nameHi: z.string(),
  nameEn: z.string(),
  position: z.number().int(),
  isPinned: z.boolean(),
  /** Null = use the bundled fallback artwork. */
  image: deityImageViewSchema.nullable(),
  /** Deity-specific offering (e.g. sindoor for Hanuman ji). The app builds the CTA text via i18n. */
  specialOffering: z
    .object({ itemId: z.uuid(), nameHi: z.string(), nameEn: z.string(), iconUrl: z.url(), coinCost: z.number().int() })
    .nullable(),
  defaultAartiId: z.uuid().nullable(),
});
export type HomeDeity = z.infer<typeof homeDeitySchema>;

export const mandirThemeSchema = z.object({
  key: z.string(),
  frameUrl: z.url(),
  colors: z.record(z.string(), z.unknown()),
  /** Deities this theme applies to; empty = all. */
  deityIds: z.array(z.uuid()),
});
export type MandirTheme = z.infer<typeof mandirThemeSchema>;

/** The thali VM-01 draws (T7b): the user's resolved selection. */
export const homeThaliSchema = z.object({
  id: z.uuid(),
  imageUrl: z.url(),
  /** "single" | "pancha" | … — flame layout preset (§4.3). */
  flameStyle: z.string(),
});
export type HomeThali = z.infer<typeof homeThaliSchema>;

export const mandirHomeSchema = z.object({
  today: z.object({
    /** "YYYY-MM-DD" in the user's timezone. */
    localDate: z.string(),
    /** 0=Sun … 6=Sat */
    weekday: z.number().int().min(0).max(6),
    tithiText: z.string(),
  }),
  theme: mandirThemeSchema.nullable(),
  /** Null only when the user's mandir is empty. */
  defaultDeityId: z.uuid().nullable(),
  deities: z.array(homeDeitySchema),
  /** Keyed by deityId; every deity in `deities` has an entry. */
  todayOfferings: z.record(z.string(), todayOfferingsSchema),
  coins: z.object({ balance: z.number().int() }),
  streak: z.object({ current: z.number().int(), longest: z.number().int(), doneToday: z.boolean() }),
  /** Null only when no active free thali design exists. */
  thali: homeThaliSchema.nullable(),
});
export type MandirHome = z.infer<typeof mandirHomeSchema>;

/** `GET /v1/deities` item (Sangrah). */
export const deityListItemSchema = z.object({
  id: z.uuid(),
  slug: z.string(),
  nameHi: z.string(),
  nameEn: z.string(),
  weekday: z.number().int().min(0).max(6).nullable(),
  image: deityImageViewSchema.nullable(),
  inMandir: z.boolean(),
});
export type DeityListItem = z.infer<typeof deityListItemSchema>;

export const MANDIR_MAX_DEITIES = 50;

export const mandirDeityEntrySchema = z.object({
  deityId: z.uuid(),
  position: z.number().int().min(0),
  isPinned: z.boolean().default(false),
});
export type MandirDeityEntry = z.infer<typeof mandirDeityEntrySchema>;

/** `PUT /v1/mandir/deities` — replaces the user's whole deity list. At most one pinned deity. */
export const setMandirDeitiesRequestSchema = z
  .object({ items: z.array(mandirDeityEntrySchema).min(1).max(MANDIR_MAX_DEITIES) })
  .superRefine(({ items }, ctx) => {
    if (new Set(items.map((i) => i.deityId)).size !== items.length) {
      ctx.addIssue({ code: 'custom', path: ['items'], message: 'Duplicate deityId' });
    }
    if (new Set(items.map((i) => i.position)).size !== items.length) {
      ctx.addIssue({ code: 'custom', path: ['items'], message: 'Duplicate position' });
    }
    if (items.filter((i) => i.isPinned).length > 1) {
      ctx.addIssue({ code: 'custom', path: ['items'], message: 'At most one deity can be pinned' });
    }
  });
export type SetMandirDeitiesRequest = z.infer<typeof setMandirDeitiesRequestSchema>;

/** Response of `PUT /v1/mandir/deities`: the saved list, sorted by position. */
export const setMandirDeitiesResponseSchema = z.object({ items: z.array(mandirDeityEntrySchema.required()) });
export type SetMandirDeitiesResponse = z.infer<typeof setMandirDeitiesResponseSchema>;

/** `PUT /v1/mandir/deities/:deityId/image` — null resets to the default resolution. */
export const setDeityImageRequestSchema = z.object({ imageId: z.uuid().nullable() });
export type SetDeityImageRequest = z.infer<typeof setDeityImageRequestSchema>;

/** The image the user now sees for that deity (after §6.2 resolution). */
export const setDeityImageResponseSchema = z.object({ deityId: z.uuid(), image: deityImageViewSchema.nullable() });
export type SetDeityImageResponse = z.infer<typeof setDeityImageResponseSchema>;
