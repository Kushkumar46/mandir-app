import type {
  AartiCompleteResponse,
  AartiLyrics,
  AppConfig,
  DeityAartis,
  DeityOfferings,
  MakeOfferingResponse,
  MandirHome,
  OfferingItemView,
  OfferingKind,
  ThaliList,
} from '@mandir/shared-types';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

/** Test helpers for Mandir screens: config/home payloads and a QueryClient without retries. */

export const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const cdn = (path: string) => `http://192.168.1.20:9000/media-public/${path}`;
const urls = (slug: string) => ({
  thumb: cdn(`official/${slug}/thumb.webp`),
  card: cdn(`official/${slug}/card.webp`),
  full: cdn(`official/${slug}/full.webp`),
  hd: cdn(`official/${slug}/hd.webp`),
});

export function configWith(flags: Record<string, boolean>): AppConfig {
  return {
    flags: Object.fromEntries(Object.entries(flags).map(([k, enabled]) => [k, { enabled, payload: null }])),
    remoteConfig: { minSupportedAppVersion: '0.0.0', supportWhatsapp: null },
    forceUpdate: false,
    serverTime: '2026-09-29T04:00:00.000Z',
  };
}

export const HANUMAN = uuid(1);
export const SHIV = uuid(2);
export const GANESH = uuid(3);

export function homePayload(overrides: Partial<MandirHome> = {}): MandirHome {
  const deity = (id: string, slug: string, nameHi: string, nameEn: string, position: number) => ({
    id,
    slug,
    nameHi,
    nameEn,
    position,
    isPinned: false,
    image: {
      id: uuid(100 + position),
      source: 'OFFICIAL' as const,
      status: 'PUBLIC' as const,
      urls: urls(slug),
      anchor: null,
      credit: null,
    },
    specialOffering: null,
    defaultAartiId: uuid(200 + position),
  });
  const hanuman = {
    ...deity(HANUMAN, 'hanuman', 'हनुमान जी', 'Hanuman ji', 0),
    specialOffering: { itemId: uuid(300), nameHi: 'सिंदूर', nameEn: 'Sindoor', iconUrl: cdn('icons/sindoor.webp'), coinCost: 0 },
  };
  return {
    today: { localDate: '2026-09-29', weekday: 2, tithiText: 'मंगलवार, आश्विन कृष्ण पक्ष तृतीया' },
    theme: { key: 'default', frameUrl: cdn('themes/default/frame.webp'), colors: {}, deityIds: [] },
    defaultDeityId: HANUMAN,
    deities: [
      hanuman,
      deity(SHIV, 'shiv', 'शिव जी', 'Shiv ji', 1),
      { ...deity(GANESH, 'ganesh', 'गणेश जी', 'Ganesh ji', 2), image: null },
    ],
    todayOfferings: {
      [HANUMAN]: { flowers: 14, mala: true, diya: true, bhog: false },
      [SHIV]: { flowers: 0, mala: false, diya: false, bhog: false },
      [GANESH]: { flowers: 0, mala: false, diya: false, bhog: false },
    },
    coins: { balance: 42 },
    streak: { current: 5, longest: 12, doneToday: true },
    thali: { id: uuid(400), imageUrl: cdn('official/thalis/pital/image.webp'), flameStyle: 'single' },
    ...overrides,
  };
}

export function createTestQueryClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { retry: false, gcTime: Infinity } } });
}

export function withQueryClient(client: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}

/** `GET /deities/:id/offerings` for Hanuman ji: a free basic + a premium item per kind (§12 seed). */
export function offeringsPayload(deityId: string = HANUMAN): DeityOfferings {
  let n = 500;
  const item = (kind: OfferingKind, nameHi: string, nameEn: string, animationKey: string, particleCount: number, coinCost: number): OfferingItemView => {
    const slug = nameEn.toLowerCase().replace(/[^a-z]+/g, '-');
    return {
      id: uuid(n++),
      kind,
      nameHi,
      nameEn,
      iconUrl: cdn(`official/offerings/${slug}/icon.webp`),
      spriteUrl: cdn(`official/offerings/${slug}/sprite.webp`),
      animationKey,
      particleCount,
      coinCost,
    };
  };
  return {
    deityId,
    groups: [
      { kind: 'FLOWER', items: [item('FLOWER', 'गेंदा फूल', 'Marigold', 'falling_flowers', 20, 0), item('FLOWER', 'गुलाब', 'Rose', 'falling_flowers', 25, 5)] },
      { kind: 'MALA', items: [item('MALA', 'गेंदे की माला', 'Marigold garland', 'mala_drop', 1, 0), item('MALA', 'गुलाब की माला', 'Rose garland', 'mala_drop', 1, 11)] },
      { kind: 'DIYA', items: [item('DIYA', 'मिट्टी का दीया', 'Clay diya', 'diya_light', 1, 0), item('DIYA', 'पंचदीप', 'Pancha-deep', 'pancha_deep', 5, 11)] },
      { kind: 'BHOG', items: [item('BHOG', 'मिश्री भोग', 'Mishri bhog', 'bhog_place', 1, 0), item('BHOG', 'छप्पन भोग', 'Chhappan bhog', 'bhog_place', 1, 21)] },
      {
        kind: 'SPECIAL',
        items: [
          item('SPECIAL', 'सिंदूर', 'Sindoor', 'sindoor_tilak', 1, 0),
          item('SPECIAL', 'चंदन', 'Chandan', 'chandan_tilak', 1, 5),
          item('SPECIAL', 'चुनरी', 'Chunari', 'chunari_drape', 1, 51),
        ],
      },
    ],
  };
}

/** `POST /mandir/offerings` answer. */
export function offeringResponse(overrides: Partial<MakeOfferingResponse> = {}): MakeOfferingResponse {
  return {
    coinsBalance: 42,
    coinsSpent: 0,
    streak: { current: 5, longest: 12, doneToday: true },
    rewards: [],
    badgesEarned: [],
    reward: null,
    todayOfferings: { flowers: 15, mala: true, diya: true, bhog: false },
    ...overrides,
  };
}

/** `GET /deities/:id/aartis`: the default aarti (30 s, like the seed) + a second one. */
export function aartisPayload(deityId: string = HANUMAN): DeityAartis {
  const aarti = (n: number, titleHi: string, titleEn: string, isDefault: boolean) => ({
    id: uuid(n),
    titleHi,
    titleEn,
    audioUrl: cdn(`audio/aarti/hanuman/${n}.m4a`),
    lyricsUrl: cdn(`lyrics/aarti/hanuman/${n}.json`),
    durationSec: 30,
    version: 1,
    isDefault,
  });
  return { deityId, items: [aarti(200, 'आरती कीजै हनुमान लला की', 'Aarti Kije Hanuman Lala Ki', true), aarti(201, 'हनुमान चालीसा', 'Hanuman Chalisa', false)] };
}

/** Lyrics timeline: one line every 5 s (like the seed). */
export const LYRICS: AartiLyrics = [0, 5, 10, 15, 20, 25].map((t, i) => ({ t, line: `पंक्ति ${i + 1}` }));

/** `GET /mandir/thalis`: free Pital (selected) + Chaandi 51 + Sona 108 (T7b seed). */
export function thalisPayload(overrides: { unlocked?: string[] } = {}): ThaliList {
  const item = (n: number, nameHi: string, nameEn: string, coinCost: number, flameStyle = 'single') => ({
    id: uuid(n),
    nameHi,
    nameEn,
    imageUrl: cdn(`official/thalis/${nameEn.toLowerCase()}/image.webp`),
    flameStyle,
    coinCost,
    unlocked: coinCost === 0 || (overrides.unlocked ?? []).includes(uuid(n)),
    selected: n === 400,
  });
  return {
    selectedThaliId: uuid(400),
    items: [item(400, 'पीतल की थाली', 'Pital', 0), item(401, 'चाँदी की थाली', 'Chaandi', 51), item(402, 'सोने की थाली', 'Sona', 108, 'pancha')],
  };
}

/** `POST /mandir/rituals/aarti-complete` answer. */
export function aartiCompleteResponse(overrides: Partial<AartiCompleteResponse> = {}): AartiCompleteResponse {
  return {
    ritualLogId: uuid(900),
    coinsBalance: 44,
    streak: { current: 6, longest: 12, doneToday: true },
    rewards: [{ ruleKey: 'AARTI_COMPLETE', coins: 2 }],
    badgesEarned: [],
    ...overrides,
  };
}
