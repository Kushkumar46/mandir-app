import { MandirFlag } from '@mandir/shared-types';
import type { QueryClient } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react-native';
import { createAudioPlayer } from 'expo-audio';
import { File } from 'expo-file-system';
import { State } from 'react-native-gesture-handler';
import { fireGestureHandler, getByGestureTestId } from 'react-native-gesture-handler/jest-utils';

import { ApiError, apiRequest, fetchPublicJson } from '@/api/client';
import { useConnectivityStore } from '@/api/connectivity';
import { queryKeys } from '@/api/keys';
import { OFFLINE_FALLBACK_CONFIG } from '@/features/config/flags';
import { useToastStore } from '@/features/shell/Toast';
import {
  aartiCompleteResponse,
  aartisPayload,
  configWith,
  createTestQueryClient,
  HANUMAN,
  homePayload,
  LYRICS,
  offeringResponse,
  offeringsPayload,
  withQueryClient,
} from '@/test/mandir-fixtures';

import { aartiLayout } from '../aarti';
import { stopAarti } from '../aarti-player';
import { useGreetingStore } from '../hooks/useFirstVisitOfDay';
import { resetOfflineQueue, useOfflineQueueStore } from '../offline-queue';
import { resetOfferingStore, useOfferingStore } from '../store/offerings';
import { mandirLayout } from '../layout';
import { useDeitySelectionStore } from '../store/selection';
import { MandirHome } from './MandirHome';

jest.mock('@/api/client', () => ({ ...jest.requireActual('@/api/client'), apiRequest: jest.fn(), fetchPublicJson: jest.fn() }));
jest.mock('expo-router', () => {
  const { useEffect } = jest.requireActual('react');
  return {
    router: { navigate: jest.fn(), push: jest.fn(), back: jest.fn() },
    useFocusEffect: (cb: () => void | (() => void)) => useEffect(cb, [cb]),
  };
});
jest.mock('../sounds', () => ({ preloadMandirSounds: jest.fn(), playBell: jest.fn(), playShankh: jest.fn() }));
jest.mock('@/lib/haptics', () => ({ impactMedium: jest.fn(), selectionTick: jest.fn() }));

const api = apiRequest as jest.MockedFunction<typeof apiRequest>;
const create = createAudioPlayer as jest.MockedFunction<typeof createAudioPlayer>;
const fs = jest.requireMock('expo-file-system') as { __files: Map<string, string> };
const download = File.downloadFileAsync as jest.Mock;
const ALL_ON = Object.fromEntries(Object.values(MandirFlag).map((k) => [k, true]));
const OFFLINE = () => Promise.reject(new ApiError(0, 'NETWORK_ERROR', 'Network request failed'));
const [DEFAULT_AARTI] = aartisPayload().items;
const CACHED_AUDIO = `file:///documents/aarti-cache/${DEFAULT_AARTI.id}-v1.m4a`;

type Opts = { body?: unknown; idempotencyKey?: string; method?: string };
type Handler = (opts: Opts) => Promise<unknown>;

/** Network switch for the mocked API: while `online` is false every call fails like airplane mode. */
let online = true;
let routes: Record<string, Handler> = {};

async function renderHome(config = configWith(ALL_ON)) {
  const client = createTestQueryClient();
  if (config) client.setQueryData(queryKeys.config, config);
  api.mockImplementation(((path: string, opts: Opts) => {
    if (!online) return OFFLINE();
    const handler = routes[path];
    return handler ? handler(opts) : Promise.reject(new Error(`unmocked ${path}`));
  }) as never);
  await render(<MandirHome />, { wrapper: withQueryClient(client) });
  await fireEvent(screen.getByTestId('mandir-scene'), 'layout', { nativeEvent: { layout: { width: 360, height: 600, x: 0, y: 110 } } });
  return client;
}

/** Loads the scene online, then loses the connection (the next refresh fails → offline banner). */
async function goOffline(client: QueryClient) {
  online = false;
  await act(async () => {
    await client.refetchQueries({ queryKey: queryKeys.mandirHome });
  });
  await screen.findByText('इंटरनेट कनेक्शन नहीं है');
}

async function backOnline(client: QueryClient) {
  online = true;
  await act(async () => {
    await client.refetchQueries({ queryKey: queryKeys.mandirHome });
  });
}

/** Drags the thali `turns` times around P (VM-06 geometry of the 360×600 scene, no picker). */
async function dragCircles(turns: number) {
  const area = { width: 360, height: 600 };
  const { center, radii } = aartiLayout(area, mandirLayout(area).arch, null, false);
  const steps = 24;
  const points = Array.from({ length: steps * turns + 1 }, (_, i) => {
    const a = Math.PI / 2 + (i * 2 * Math.PI) / steps;
    return { x: center.x + radii.rx * Math.cos(a), y: center.y + radii.ry * Math.sin(a) };
  });
  await act(async () => {
    fireGestureHandler(getByGestureTestId('aarti-thali-pan'), [
      { state: State.BEGAN, ...points[0] },
      ...points.slice(1).map((p) => ({ state: State.ACTIVE, ...p })),
      { state: State.END, ...points.at(-1)! },
    ]);
  });
}

const posts = (path: string) => api.mock.calls.filter(([p]) => p === path).map(([, o]) => o as Opts);
const toast = () => useToastStore.getState().toast?.message;

beforeEach(() => {
  useConnectivityStore.setState({ offline: false });
  online = true;
  routes = {
    '/mandir/home': () => Promise.resolve(homePayload()),
    [`/deities/${HANUMAN}/offerings`]: () => Promise.resolve(offeringsPayload()),
    [`/deities/${HANUMAN}/aartis`]: () => Promise.resolve(aartisPayload()),
    '/mandir/offerings': () => Promise.resolve(offeringResponse()),
    '/mandir/rituals/aarti-complete': () => Promise.resolve(aartiCompleteResponse()),
    '/mandir/thalis': () => Promise.reject(new Error('not needed')),
  };
  api.mockReset();
  (fetchPublicJson as jest.Mock).mockResolvedValue(LYRICS);
  fs.__files.clear();
  download.mockImplementation(() => new Promise(() => undefined));
  create.mockClear();
  stopAarti();
  resetOfflineQueue();
  resetOfferingStore();
  useDeitySelectionStore.setState({ selectedDeityId: null });
  useGreetingStore.setState({ glowDate: null });
  useToastStore.setState({ toast: null });
});

describe('T14 fresh install without internet', () => {
  it('opens the fallback mandir (bundled artwork, bells) with a retry, then the real one', async () => {
    online = false;
    // ConfigGate hands the offline fallback config down when nothing was ever loaded.
    await renderHome(OFFLINE_FALLBACK_CONFIG);
    const card = await screen.findByTestId('mandir-offline-fallback', {}, { timeout: 8000 });
    expect(within(card).getByText('इंटरनेट से जुड़ें')).toBeTruthy();
    expect(screen.getByText('इंटरनेट कनेक्शन नहीं है')).toBeTruthy();
    expect(screen.getAllByLabelText('घंटी बजाएं')[0]).toHaveProp('accessibilityState', expect.objectContaining({ disabled: false }));
    await fireEvent.press(screen.getAllByLabelText('घंटी बजाएं')[0]);
    expect(jest.requireMock('../sounds').playBell).toHaveBeenCalled();
    expect(screen.queryByLabelText('फूल')).toBeNull(); // offerings are off in the fallback config

    online = true;
    await fireEvent.press(within(card).getByText('फिर से कोशिश करें'));
    expect(await screen.findByLabelText('हनुमान जी के दर्शन')).toBeTruthy();
    expect(screen.queryByTestId('mandir-offline-fallback')).toBeNull();
  }, 15000);
});

describe('T14 offline offerings (queued)', () => {
  it('a free offering offline animates, grows the pile and is queued — no request', async () => {
    const client = await renderHome();
    await screen.findByLabelText('हनुमान जी के दर्शन');
    await waitFor(() => expect(client.getQueryData(queryKeys.deityOfferings(HANUMAN))).toBeDefined());
    await goOffline(client);

    await fireEvent.press(screen.getByLabelText('फूल'));
    await fireEvent.press(within(await screen.findByTestId('offering-sheet')).getByLabelText('गेंदा फूल, निःशुल्क'));
    expect(await screen.findByTestId('particle-shower')).toBeTruthy();
    expect(posts('/mandir/offerings')).toHaveLength(0); // not even tried
    const queued = useOfflineQueueStore.getState().items;
    expect(queued).toHaveLength(1);
    expect(queued[0]).toMatchObject({ kind: 'offering', body: { deityId: HANUMAN }, offeringKind: 'FLOWER' });
    expect(client.getQueryData<ReturnType<typeof homePayload>>(queryKeys.mandirHome)!.todayOfferings[HANUMAN].flowers).toBe(15);
    expect(client.getQueryData<ReturnType<typeof homePayload>>(queryKeys.mandirHome)!.coins.balance).toBe(42);

    // back online: the queued offering is sent with its original key
    await act(async () => useOfferingStore.getState().finish(useOfferingStore.getState().active!.id));
    routes['/mandir/offerings'] = () => Promise.resolve(offeringResponse({ coinsBalance: 43, todayOfferings: { flowers: 15, mala: true, diya: true, bhog: false } }));
    await backOnline(client);
    await waitFor(() => expect(posts('/mandir/offerings')).toHaveLength(1));
    expect(posts('/mandir/offerings')[0].idempotencyKey).toBe(queued[0].key);
    await waitFor(() => expect(useOfflineQueueStore.getState().items).toEqual([]));
    await waitFor(() => expect(client.getQueryData<ReturnType<typeof homePayload>>(queryKeys.mandirHome)!.coins.balance).toBe(43));
  });

  it('a free offering whose request fails for lack of network is queued with the same key', async () => {
    const client = await renderHome();
    await screen.findByLabelText('हनुमान जी के दर्शन');
    await waitFor(() => expect(client.getQueryData(queryKeys.deityOfferings(HANUMAN))).toBeDefined());
    routes['/mandir/offerings'] = OFFLINE;
    await fireEvent.press(screen.getByLabelText('माला'));
    await fireEvent.press(within(await screen.findByTestId('offering-sheet')).getByLabelText('गेंदे की माला, निःशुल्क'));
    await waitFor(() => expect(useOfflineQueueStore.getState().items).toHaveLength(1));
    expect(useOfflineQueueStore.getState().items[0].key).toBe(posts('/mandir/offerings')[0].idempotencyKey);
    expect(toast()).toBeUndefined();
  });

  it('paid offerings need the internet', async () => {
    const client = await renderHome();
    await screen.findByLabelText('हनुमान जी के दर्शन');
    await waitFor(() => expect(client.getQueryData(queryKeys.deityOfferings(HANUMAN))).toBeDefined());
    await goOffline(client);
    await fireEvent.press(screen.getByLabelText('दीया'));
    await fireEvent.press(within(await screen.findByTestId('offering-sheet')).getByLabelText('पंचदीप, 11 सिक्के'));
    expect(toast()).toBe('इंटरनेट से जुड़ें');
    expect(useOfflineQueueStore.getState().items).toEqual([]);
  });
});

describe('T14 cached aarti', () => {
  it('prefetches the default aarti (audio + lyrics) with the scene', async () => {
    await renderHome();
    await screen.findByLabelText('हनुमान जी के दर्शन');
    await waitFor(() => expect(download).toHaveBeenCalledWith(DEFAULT_AARTI.audioUrl, expect.anything(), { idempotent: true }));
    await waitFor(() => expect(fs.__files.has(`file:///documents/aarti-cache/${DEFAULT_AARTI.id}-v1.json`)).toBe(true));
  });

  it('plays the downloaded file offline; lyrics come from the device', async () => {
    fs.__files.set(CACHED_AUDIO, 'audio');
    fs.__files.set(`file:///documents/aarti-cache/${DEFAULT_AARTI.id}-v1.json`, JSON.stringify(LYRICS));
    const client = await renderHome();
    await screen.findByLabelText('हनुमान जी के दर्शन');
    await waitFor(() => expect(client.getQueryData(queryKeys.deityAartis(HANUMAN))).toBeDefined());
    await goOffline(client);
    (fetchPublicJson as jest.Mock).mockClear();

    await fireEvent.press(screen.getByLabelText('आरती करें'));
    await screen.findByTestId('aarti-mode');
    await waitFor(() => expect(create).toHaveBeenLastCalledWith({ uri: CACHED_AUDIO }, { updateInterval: 250 }));
    expect(await screen.findByTestId('aarti-lyric-current')).toHaveTextContent('पंक्ति 1');
    expect(fetchPublicJson).not.toHaveBeenCalled();
  });

  it('offline without a download: says so instead of playing', async () => {
    const client = await renderHome();
    await screen.findByLabelText('हनुमान जी के दर्शन');
    await waitFor(() => expect(client.getQueryData(queryKeys.deityAartis(HANUMAN))).toBeDefined());
    await goOffline(client);
    create.mockClear();

    await fireEvent.press(screen.getByLabelText('आरती करें'));
    expect(await screen.findByText('यह आरती अभी डाउनलोड नहीं हुई है। इंटरनेट से जुड़ें।')).toBeTruthy();
    expect(create).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByLabelText('आरती बंद करें'));
    await fireEvent.press(within(await screen.findByTestId('aarti-confirm-close')).getByText('बंद करें'));

    await fireEvent.press(screen.getByLabelText('सुनें'));
    await waitFor(() => expect(toast()).toBe('यह आरती अभी डाउनलोड नहीं हुई है। इंटरनेट से जुड़ें।'));
    expect(create).not.toHaveBeenCalled();
  });

  it('an aarti completed offline is queued and sent later with the same key', async () => {
    fs.__files.set(CACHED_AUDIO, 'audio');
    const client = await renderHome(configWith({ ...ALL_ON, [MandirFlag.THALI_DESIGNS]: false }));
    await screen.findByLabelText('हनुमान जी के दर्शन');
    await fireEvent.press(screen.getByLabelText('आरती करें'));
    await screen.findByTestId('aarti-mode');
    await waitFor(() => expect(create).toHaveBeenCalled());
    const player = create.mock.results.at(-1)!.value as { __emit: (s: object) => void };
    routes['/mandir/rituals/aarti-complete'] = OFFLINE;

    await act(async () => player.__emit({ currentTime: 29, duration: 30, playing: true, didJustFinish: false, isLoaded: true, isBuffering: false }));
    await dragCircles(3);

    const card = await screen.findByTestId('aarti-complete');
    expect(await within(card).findByText('इंटरनेट मिलते ही आरती दर्ज हो जाएगी')).toBeTruthy();
    expect(within(card).queryByText('फिर से कोशिश करें')).toBeNull();
    const [sent] = posts('/mandir/rituals/aarti-complete');
    expect(useOfflineQueueStore.getState().items).toEqual([expect.objectContaining({ kind: 'aarti', key: sent.idempotencyKey, body: sent.body })]);

    routes['/mandir/rituals/aarti-complete'] = () => Promise.resolve(aartiCompleteResponse({ coinsBalance: 44 }));
    await backOnline(client);
    await waitFor(() => expect(posts('/mandir/rituals/aarti-complete')).toHaveLength(2));
    expect(posts('/mandir/rituals/aarti-complete')[1].idempotencyKey).toBe(sent.idempotencyKey);
    await waitFor(() => expect(useOfflineQueueStore.getState().items).toEqual([]));
  });
});
