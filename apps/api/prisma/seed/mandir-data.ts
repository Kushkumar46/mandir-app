/**
 * Virtual Mandir seed content (docs/modules/01-virtual-mandir.md §5, §6.1, §6.4, §9, §12).
 * Everything here is admin-editable after seeding; the seed only creates missing rows.
 */
import { MandirFlag } from '@mandir/shared-types';

import type { OfferingKind } from '../../src/generated/prisma/client.js';

export interface SeedTemple {
  name: string;
  nameHi: string;
  city: string;
  state: string;
  lat: number;
  lng: number;
  photographyRestricted?: boolean;
}

export interface SeedDeity {
  slug: string;
  nameHi: string;
  nameEn: string;
  /** 0=Sun … 6=Sat (§6.1 weekday map); null = no weekday. */
  weekday: number | null;
  /** Placeholder artwork colours: [top, bottom]. */
  colors: [string, string];
  temple: SeedTemple;
  aarti: { titleHi: string; titleEn: string };
}

export const DEITIES: SeedDeity[] = [
  {
    slug: 'ganesh',
    nameHi: 'गणेश जी',
    nameEn: 'Ganesh Ji',
    weekday: 3,
    colors: ['#F4A300', '#B3360B'],
    temple: { name: 'Shree Siddhivinayak Temple', nameHi: 'श्री सिद्धिविनायक मंदिर', city: 'Mumbai', state: 'Maharashtra', lat: 19.0169, lng: 72.8302 },
    aarti: { titleHi: 'जय गणेश जय गणेश देवा', titleEn: 'Jai Ganesh Deva' },
  },
  {
    slug: 'shiv',
    nameHi: 'शिव जी',
    nameEn: 'Shiv Ji',
    weekday: 1,
    colors: ['#6F8FAF', '#1F2F4A'],
    temple: { name: 'Shri Kashi Vishwanath Temple', nameHi: 'श्री काशी विश्वनाथ मंदिर', city: 'Varanasi', state: 'Uttar Pradesh', lat: 25.3109, lng: 83.0107 },
    aarti: { titleHi: 'ॐ जय शिव ओंकारा', titleEn: 'Om Jai Shiv Omkara' },
  },
  {
    slug: 'hanuman',
    nameHi: 'हनुमान जी',
    nameEn: 'Hanuman Ji',
    weekday: 2,
    colors: ['#FF8A1F', '#A3260E'],
    temple: { name: 'Hanuman Garhi', nameHi: 'हनुमान गढ़ी', city: 'Ayodhya', state: 'Uttar Pradesh', lat: 26.7956, lng: 82.1994 },
    aarti: { titleHi: 'आरती कीजै हनुमान लला की', titleEn: 'Aarti Kije Hanuman Lala Ki' },
  },
  {
    slug: 'vishnu',
    nameHi: 'विष्णु जी',
    nameEn: 'Vishnu Ji',
    weekday: 4,
    colors: ['#4F8FE0', '#152F6B'],
    // Photography is not allowed inside; keeps one restricted temple for §6.2 testing.
    temple: { name: 'Sri Venkateswara Temple, Tirumala', nameHi: 'श्री वेंकटेश्वर मंदिर, तिरुमला', city: 'Tirupati', state: 'Andhra Pradesh', lat: 13.6833, lng: 79.3474, photographyRestricted: true },
    aarti: { titleHi: 'ॐ जय जगदीश हरे', titleEn: 'Om Jai Jagdish Hare' },
  },
  {
    slug: 'lakshmi',
    nameHi: 'लक्ष्मी माता',
    nameEn: 'Lakshmi Mata',
    weekday: 5,
    colors: ['#F7C6D0', '#B8336A'],
    temple: { name: 'Shri Mahalakshmi (Ambabai) Temple', nameHi: 'श्री महालक्ष्मी (अंबाबाई) मंदिर', city: 'Kolhapur', state: 'Maharashtra', lat: 16.6949, lng: 74.224 },
    aarti: { titleHi: 'ॐ जय लक्ष्मी माता', titleEn: 'Om Jai Lakshmi Mata' },
  },
  {
    slug: 'durga',
    nameHi: 'दुर्गा माता',
    nameEn: 'Durga Mata',
    weekday: null,
    colors: ['#E53935', '#6B0F1A'],
    temple: { name: 'Shri Mata Vaishno Devi Shrine', nameHi: 'श्री माता वैष्णो देवी', city: 'Katra', state: 'Jammu and Kashmir', lat: 33.0299, lng: 74.949 },
    aarti: { titleHi: 'जय अम्बे गौरी', titleEn: 'Jai Ambe Gauri' },
  },
  {
    slug: 'krishna',
    nameHi: 'कृष्ण जी',
    nameEn: 'Krishna Ji',
    weekday: null,
    colors: ['#3AA3A0', '#12305E'],
    temple: { name: 'Shri Banke Bihari Temple', nameHi: 'श्री बांके बिहारी मंदिर', city: 'Vrindavan', state: 'Uttar Pradesh', lat: 27.5806, lng: 77.6995 },
    aarti: { titleHi: 'आरती कुंजबिहारी की', titleEn: 'Aarti Kunj Bihari Ki' },
  },
  {
    slug: 'ram',
    nameHi: 'राम जी',
    nameEn: 'Ram Ji',
    weekday: null,
    colors: ['#FFB74D', '#C2410C'],
    temple: { name: 'Shri Ram Janmabhoomi Mandir', nameHi: 'श्री राम जन्मभूमि मंदिर', city: 'Ayodhya', state: 'Uttar Pradesh', lat: 26.7957, lng: 82.1943 },
    aarti: { titleHi: 'आरती कीजै श्री रघुवर जी की', titleEn: 'Aarti Kije Shri Raghuvar Ji Ki' },
  },
  {
    slug: 'shani',
    nameHi: 'शनि देव',
    nameEn: 'Shani Dev',
    weekday: 6,
    colors: ['#5C6B7A', '#111827'],
    temple: { name: 'Shri Shanidev Temple, Shani Shingnapur', nameHi: 'श्री शनिदेव मंदिर, शनि शिंगणापुर', city: 'Shingnapur', state: 'Maharashtra', lat: 19.3979, lng: 74.8541 },
    aarti: { titleHi: 'जय जय श्री शनिदेव', titleEn: 'Jai Jai Shri Shanidev' },
  },
  {
    slug: 'surya',
    nameHi: 'सूर्य देव',
    nameEn: 'Surya Dev',
    weekday: 0,
    colors: ['#FFD54F', '#E65100'],
    temple: { name: 'Konark Sun Temple', nameHi: 'कोणार्क सूर्य मंदिर', city: 'Konark', state: 'Odisha', lat: 19.8876, lng: 86.0945 },
    aarti: { titleHi: 'ॐ जय सूर्य भगवान', titleEn: 'Om Jai Surya Bhagwan' },
  },
];

export interface SeedOffering {
  key: string;
  kind: OfferingKind;
  nameHi: string;
  nameEn: string;
  animationKey: string;
  particleCount: number;
  coinCost: number;
  /** Deity slugs; empty = all deities. */
  deities: string[];
  /** Placeholder sprite colour. */
  color: string;
}

/**
 * §12 seed offerings: every kind has at least one free basic item; coins are only for premium items.
 * Coin costs are placeholders (set in admin). Particle counts stay ≤ 30 (§4.6 budget).
 */
export const OFFERINGS: SeedOffering[] = [
  // Free basics
  { key: 'genda', kind: 'FLOWER', nameHi: 'गेंदा फूल', nameEn: 'Marigold', animationKey: 'falling_flowers', particleCount: 20, coinCost: 0, deities: [], color: '#FFA000' },
  { key: 'genda-mala', kind: 'MALA', nameHi: 'गेंदे की माला', nameEn: 'Marigold garland', animationKey: 'mala_drop', particleCount: 1, coinCost: 0, deities: [], color: '#FB8C00' },
  { key: 'mitti-diya', kind: 'DIYA', nameHi: 'मिट्टी का दीया', nameEn: 'Clay diya', animationKey: 'diya_light', particleCount: 1, coinCost: 0, deities: [], color: '#A1662F' },
  { key: 'mishri', kind: 'BHOG', nameHi: 'मिश्री भोग', nameEn: 'Mishri bhog', animationKey: 'bhog_place', particleCount: 1, coinCost: 0, deities: [], color: '#F5F5F5' },
  { key: 'sindoor', kind: 'SPECIAL', nameHi: 'सिंदूर', nameEn: 'Sindoor', animationKey: 'sindoor_tilak', particleCount: 1, coinCost: 0, deities: ['hanuman'], color: '#E53935' },
  { key: 'jal', kind: 'SPECIAL', nameHi: 'जल अभिषेक', nameEn: 'Jal abhishek', animationKey: 'jal_abhishek', particleCount: 15, coinCost: 0, deities: ['shiv'], color: '#4FC3F7' },
  { key: 'tel', kind: 'SPECIAL', nameHi: 'सरसों का तेल', nameEn: 'Mustard oil', animationKey: 'tel_abhishek', particleCount: 10, coinCost: 0, deities: ['shani'], color: '#827717' },
  // Premium
  { key: 'gulab', kind: 'FLOWER', nameHi: 'गुलाब', nameEn: 'Rose', animationKey: 'falling_flowers', particleCount: 25, coinCost: 5, deities: [], color: '#D81B60' },
  { key: 'kamal', kind: 'FLOWER', nameHi: 'कमल', nameEn: 'Lotus', animationKey: 'falling_flowers', particleCount: 12, coinCost: 11, deities: [], color: '#F48FB1' },
  { key: 'phool-varsha-108', kind: 'FLOWER', nameHi: '108 फूलों की वर्षा', nameEn: '108 flower shower', animationKey: 'phool_varsha', particleCount: 30, coinCost: 21, deities: [], color: '#FF7043' },
  { key: 'gulab-mala', kind: 'MALA', nameHi: 'गुलाब की माला', nameEn: 'Rose garland', animationKey: 'mala_drop', particleCount: 1, coinCost: 11, deities: [], color: '#C2185B' },
  { key: 'pancha-deep', kind: 'DIYA', nameHi: 'पंचदीप', nameEn: 'Pancha-deep', animationKey: 'pancha_deep', particleCount: 5, coinCost: 11, deities: [], color: '#FFC107' },
  { key: 'chhappan-bhog', kind: 'BHOG', nameHi: 'छप्पन भोग', nameEn: 'Chhappan bhog', animationKey: 'bhog_place', particleCount: 1, coinCost: 21, deities: [], color: '#FFB300' },
  { key: 'chandan', kind: 'SPECIAL', nameHi: 'चंदन', nameEn: 'Chandan', animationKey: 'chandan_tilak', particleCount: 1, coinCost: 5, deities: [], color: '#E6C79C' },
  { key: 'chunari', kind: 'SPECIAL', nameHi: 'चुनरी', nameEn: 'Chunari', animationKey: 'chunari_drape', particleCount: 1, coinCost: 21, deities: ['durga', 'lakshmi'], color: '#C62828' },
];

/** Items earlier seeds created that are no longer in the catalogue; the seed deactivates them. */
export const RETIRED_OFFERING_KEYS = ['ghee-diya', 'laddoo'];

/** Store product ids are placeholders until the App Store / Play Console products exist (T15). */
export const COIN_PACKS = [
  { coins: 51, bonusCoins: 0 },
  { coins: 101, bonusCoins: 10 },
  { coins: 251, bonusCoins: 30 },
  { coins: 501, bonusCoins: 75 },
].map((p, i) => ({
  ...p,
  productIdIos: `coins_${p.coins}`,
  productIdAndroid: `coins_${p.coins}`,
  sortOrder: i,
}));

/** §6.4. `dailyCap` null = no daily cap; "once" rules are enforced by the reward logic (T6/T7). */
export const REWARD_RULES = [
  { key: 'FIRST_DARSHAN_OF_DAY', coins: 1, dailyCap: 1 },
  { key: 'AARTI_COMPLETE', coins: 2, dailyCap: 2 },
  { key: 'STREAK_7', coins: 10, dailyCap: null },
  { key: 'STREAK_21', coins: 25, dailyCap: null },
  { key: 'STREAK_51', coins: 51, dailyCap: null },
  { key: 'STREAK_108', coins: 108, dailyCap: null },
  { key: 'UPLOAD_APPROVED', coins: 20, dailyCap: 5 },
  { key: 'IMAGE_USED_BY_10', coins: 10, dailyCap: null },
  { key: 'WELCOME_BONUS', coins: 10, dailyCap: null },
];

/** §9 defaults at launch. */
export const MANDIR_FLAGS: { key: string; enabled: boolean; description: string }[] = [
  { key: MandirFlag.ENABLED, enabled: true, description: 'Virtual Mandir: whole module' },
  { key: MandirFlag.OFFERINGS, enabled: true, description: 'Virtual Mandir: offering sheets' },
  { key: MandirFlag.PREMIUM_OFFERINGS, enabled: true, description: 'Virtual Mandir: paid offering items' },
  { key: MandirFlag.COINS_PURCHASE, enabled: true, description: 'Virtual Mandir: buying coin packs' },
  { key: MandirFlag.REWARDS, enabled: true, description: 'Virtual Mandir: reward rules' },
  { key: MandirFlag.COMMUNITY_UPLOAD, enabled: true, description: 'Virtual Mandir: community upload flow' },
  { key: MandirFlag.COMMUNITY_GALLERY, enabled: true, description: 'Virtual Mandir: community tab + gallery' },
  { key: MandirFlag.HOME_MANDIR, enabled: true, description: 'Virtual Mandir: home mandir uploads' },
  { key: MandirFlag.SHARE_CARD, enabled: true, description: 'Virtual Mandir: share card' },
  { key: MandirFlag.FESTIVAL_THEMES, enabled: false, description: 'Virtual Mandir: festival theme switching' },
  { key: MandirFlag.STARTUP_SHANKH_SOUND, enabled: true, description: 'Virtual Mandir: shankh on first open of day' },
];

/** Remote config keys this module reads (§7 Config); merged into `app.remote_config` if missing. */
export const MANDIR_REMOTE_CONFIG = {
  uploadMaxPerDay: 10,
  shareAppLink: null,
  /** T7: seconds on VM-01 before the darshan ping; null = pings don't count for the streak (§6.3). */
  darshanPingSeconds: 20,
};

/** Keys this module no longer reads; the seed removes them (free offerings are unlimited, §6.5). */
export const OBSOLETE_REMOTE_CONFIG_KEYS = ['freeOfferingsPerDeityPerDay'];

export const DEFAULT_THEME = {
  key: 'default',
  colors: {
    primary: '#E07A1F',
    secondary: '#6B1E1E',
    accent: '#D4A537',
    background: '#FFF6E5',
    text: '#2B1A10',
  },
};

export const DEV_USER_START_COINS = 50;

/** Placeholder aarti audio length; the lyrics timeline spans the same duration. */
export const PLACEHOLDER_AARTI_SECONDS = 30;
