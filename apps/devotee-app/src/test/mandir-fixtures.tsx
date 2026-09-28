import type { AppConfig, MandirHome } from '@mandir/shared-types';
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
