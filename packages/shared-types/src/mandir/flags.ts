/** Virtual Mandir feature flags (docs/modules/01-virtual-mandir.md §9). Seeded by T3. */
export const MandirFlag = {
  ENABLED: 'mandir.enabled',
  OFFERINGS: 'mandir.offerings',
  PREMIUM_OFFERINGS: 'mandir.premium_offerings',
  COINS_PURCHASE: 'mandir.coins_purchase',
  REWARDS: 'mandir.rewards',
  COMMUNITY_UPLOAD: 'mandir.community_upload',
  COMMUNITY_GALLERY: 'mandir.community_gallery',
  HOME_MANDIR: 'mandir.home_mandir',
  SHARE_CARD: 'mandir.share_card',
  FESTIVAL_THEMES: 'mandir.festival_themes',
  STARTUP_SHANKH_SOUND: 'mandir.startup_shankh_sound',
} as const;

export type MandirFlag = (typeof MandirFlag)[keyof typeof MandirFlag];
