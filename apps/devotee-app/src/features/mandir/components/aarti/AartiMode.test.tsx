import { MandirFlag } from '@mandir/shared-types';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react-native';
import { createAudioPlayer } from 'expo-audio';
import { State } from 'react-native-gesture-handler';
import { fireGestureHandler, getByGestureTestId } from 'react-native-gesture-handler/jest-utils';

import { ApiError, apiRequest, fetchPublicJson } from '@/api/client';
import { queryKeys } from '@/api/keys';
import { useTabBarStore } from '@/features/shell/tabBar';
import { useToastStore } from '@/features/shell/Toast';
import { setAnalyticsSink } from '@/lib/analytics';
import {
  aartiCompleteResponse,
  aartisPayload,
  configWith,
  createTestQueryClient,
  HANUMAN,
  homePayload,
  LYRICS,
  thalisPayload,
  uuid,
  withQueryClient,
} from '@/test/mandir-fixtures';

import { aartiLayout } from '../../aarti';
import { stopAarti, useAartiPlayerStore } from '../../aarti-player';
import { useGreetingStore } from '../../hooks/useFirstVisitOfDay';
import { mandirLayout } from '../../layout';
import { resetOfferingStore } from '../../store/offerings';
import { useDeitySelectionStore } from '../../store/selection';
import { MandirHome } from '../MandirHome';

jest.mock('@/api/client', () => ({ ...jest.requireActual('@/api/client'), apiRequest: jest.fn(), fetchPublicJson: jest.fn() }));
jest.mock('expo-router', () => {
  const { useEffect } = jest.requireActual('react');
  return {
    router: { navigate: jest.fn(), push: jest.fn(), back: jest.fn() },
    useFocusEffect: (cb: () => void | (() => void)) => useEffect(cb, [cb]),
  };
});
jest.mock('../../sounds', () => ({ preloadMandirSounds: jest.fn(), playBell: jest.fn(), playShankh: jest.fn() }));
jest.mock('@/lib/haptics', () => ({ impactMedium: jest.fn(), selectionTick: jest.fn() }));

const api = apiRequest as jest.MockedFunction<typeof apiRequest>;
const lyricsFetch = fetchPublicJson as jest.MockedFunction<typeof fetchPublicJson>;
const create = createAudioPlayer as jest.MockedFunction<typeof createAudioPlayer>;
type MockPlayer = ReturnType<typeof createAudioPlayer> & { __emit: (s: object) => void };
const lastPlayer = () => create.mock.results.at(-1)!.value as MockPlayer;

const ALL_ON = Object.fromEntries(Object.values(MandirFlag).map((k) => [k, true]));
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const SCENE = { width: 360, height: 600 };
const TOP_BAR = 110;
const [DEFAULT_AARTI, CHALISA] = aartisPayload().items;
const CHAANDI = uuid(401);
/** Enough coins for Chaandi (51), not for Sona (108). */
const RICH = () => homePayload({ coins: { balance: 60 } });

type Opts = { body?: unknown; idempotencyKey?: string; method?: string };
type Routes = Partial<Record<string, (opts: Opts) => Promise<unknown>>>;

async function renderHome({ flags = ALL_ON, routes = {}, home = homePayload() }: { flags?: Record<string, boolean>; routes?: Routes; home?: ReturnType<typeof homePayload> } = {}) {
  const client = createTestQueryClient();
  client.setQueryData(queryKeys.config, configWith(flags));
  const defaults: Routes = {
    '/mandir/home': () => Promise.resolve(home),
    [`/deities/${HANUMAN}/aartis`]: () => Promise.resolve(aartisPayload()),
    '/mandir/thalis': () => Promise.resolve(thalisPayload()),
    '/mandir/rituals/aarti-complete': () => Promise.resolve(aartiCompleteResponse()),
    '/mandir/thali': (o) => Promise.resolve({ selectedThaliId: (o.body as { thaliId: string }).thaliId }),
  };
  const all = { ...defaults, ...routes };
  api.mockImplementation(((path: string, opts: Opts) => {
    const handler = all[path] ?? (path.startsWith('/mandir/thalis/') ? all['unlock'] : undefined);
    return handler ? handler(opts) : Promise.reject(new Error(`unmocked ${path}`));
  }) as never);
  lyricsFetch.mockResolvedValue(LYRICS);
  await render(<MandirHome />, { wrapper: withQueryClient(client) });
  await fireEvent(screen.getByTestId('mandir-scene'), 'layout', { nativeEvent: { layout: { ...SCENE, x: 0, y: TOP_BAR } } });
  await screen.findByLabelText('हनुमान जी के दर्शन');
  return client;
}

async function openAarti() {
  await fireEvent.press(screen.getByLabelText('आरती करें'));
  await screen.findByTestId('aarti-mode');
  await screen.findByRole('radio', { name: DEFAULT_AARTI.titleHi });
  return lastPlayer();
}

/** Status update from the audio player (4×/s on a phone). */
async function emit(player: MockPlayer, s: { currentTime: number; didJustFinish?: boolean; playing?: boolean }) {
  await act(async () => {
    player.__emit({ duration: 30, playing: true, didJustFinish: false, isLoaded: true, isBuffering: false, ...s });
  });
}

const calls = (path: string) => api.mock.calls.filter(([p]) => p === path);
const toast = () => useToastStore.getState().toast?.message;

let events: { event: string; props: Record<string, unknown> }[] = [];
let restoreAnalytics: () => void;

beforeEach(() => {
  // Auto circles grow with time: every test runs on fake timers (findBy/waitFor advance them).
  jest.useFakeTimers({ now: new Date('2026-09-29T04:00:00Z') });
  api.mockReset();
  lyricsFetch.mockReset();
  stopAarti();
  create.mockClear();
  resetOfferingStore();
  useDeitySelectionStore.setState({ selectedDeityId: null });
  useGreetingStore.setState({ glowDate: null });
  useToastStore.setState({ toast: null });
  useTabBarStore.setState({ hidden: false });
  events = [];
  restoreAnalytics = setAnalyticsSink((event, props) => events.push({ event, props }));
});
afterEach(() => {
  restoreAnalytics();
  jest.useRealTimers();
});

describe('VM-06 aarti mode', () => {
  it('opens full screen from the thali and plays the default aarti with lock-screen controls', async () => {
    await renderHome();
    const player = await openAarti();

    expect(useTabBarStore.getState().hidden).toBe(true);
    expect(screen.queryByLabelText('फूल')).toBeNull(); // rail hidden behind the overlay
    expect(create).toHaveBeenLastCalledWith({ uri: DEFAULT_AARTI.audioUrl }, { updateInterval: 250 });
    expect(player.setActiveForLockScreen).toHaveBeenCalledWith(
      true,
      { title: DEFAULT_AARTI.titleHi, artist: 'हनुमान जी', artworkUrl: homePayload().deities[0].image!.urls.thumb },
      { showSeekForward: false, showSeekBackward: false },
    );
    expect(player.play).toHaveBeenCalled();
    expect(events).toContainEqual({ event: 'aarti_started', props: { aartiId: DEFAULT_AARTI.id } });
    // selector: 2 aartis
    expect(screen.getByRole('radio', { name: DEFAULT_AARTI.titleHi })).toHaveProp('accessibilityState', { selected: true });
  });

  it('highlights the current lyric line and shows progress', async () => {
    await renderHome();
    const player = await openAarti();
    await emit(player, { currentTime: 11 });
    expect(await screen.findByTestId('aarti-lyric-current')).toHaveTextContent('पंक्ति 3');
    expect(screen.getByText('पंक्ति 2')).toBeTruthy();
    expect(screen.getByText('पंक्ति 4')).toBeTruthy();
    expect(screen.queryByText('पंक्ति 6')).toBeNull(); // 3 lines visible
    expect(screen.getByText('0:11')).toBeTruthy();
    expect(screen.getByText('0:30')).toBeTruthy();
  });

  it('pause / play and the shankh button', async () => {
    await renderHome();
    const player = await openAarti();
    await emit(player, { currentTime: 3 });
    await fireEvent.press(screen.getByLabelText('आरती रोकें'));
    expect(player.pause).toHaveBeenCalled();
    await fireEvent.press(await screen.findByLabelText('आरती चलाएं'));
    expect(player.play).toHaveBeenCalledTimes(2);
    await fireEvent.press(screen.getByLabelText('शंख बजाएं'));
    expect(jest.requireMock('../../sounds').playShankh).toHaveBeenCalled();
    await fireEvent.press(screen.getAllByLabelText('घंटी बजाएं')[0]);
    expect(jest.requireMock('../../sounds').playBell).toHaveBeenCalled();
  });

  it('counts circles dragged around P', async () => {
    await renderHome({ flags: { ...ALL_ON, [MandirFlag.THALI_DESIGNS]: false } });
    await openAarti();
    const layout = mandirLayout(SCENE);
    const { center, radii } = aartiLayout(SCENE, layout.arch, null, false);
    const steps = 24;
    const points = Array.from({ length: steps * 3 + 1 }, (_, i) => {
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
    await waitFor(() => expect(screen.getByTestId('aarti-circles')).toHaveTextContent(/परिक्रमा 3\/3$/));
  });

  it('Auto: completes once 90% is played and 3 circles are made, posts once with an Idempotency-Key', async () => {
    await renderHome();
    const player = await openAarti();
    await fireEvent.press(screen.getByRole('switch', { name: 'थाली अपने आप घुमाएं' }));

    await emit(player, { currentTime: 27 }); // 90% played, but only 0 circles yet
    expect(calls('/mandir/rituals/aarti-complete')).toHaveLength(0);
    await act(async () => jest.advanceTimersByTime(6100));
    expect(screen.getByTestId('aarti-circles')).toHaveTextContent(/परिक्रमा 2\/3$/);
    expect(calls('/mandir/rituals/aarti-complete')).toHaveLength(0);
    await act(async () => jest.advanceTimersByTime(3000));

    expect(await screen.findByText('आरती सम्पन्न 🙏')).toBeTruthy();
    const [[, opts]] = calls('/mandir/rituals/aarti-complete') as unknown as [string, Opts][];
    expect(opts).toMatchObject({ method: 'POST', body: { deityId: HANUMAN, aartiId: DEFAULT_AARTI.id, playedRatio: 0.9, circles: 3 } });
    expect(opts.idempotencyKey).toMatch(UUID);
    expect(await screen.findByText('🔥 6 दिन की साधना')).toBeTruthy();
    expect(toast()).toBe('🎉 +2 सिक्के मिले — आरती सम्पन्न');
    expect(events).toContainEqual({ event: 'aarti_completed', props: { aartiId: DEFAULT_AARTI.id, circles: 3, auto: true } });

    // more status updates / circles never post again
    await emit(player, { currentTime: 30, didJustFinish: true, playing: false });
    await act(async () => jest.advanceTimersByTime(6000));
    expect(calls('/mandir/rituals/aarti-complete')).toHaveLength(1);

    // balance from the server in the header pill; close without confirmation
    expect(await screen.findByLabelText('44 सिक्के')).toBeTruthy();
    await fireEvent.press(within(screen.getByTestId('aarti-complete')).getByText('बंद करें'));
    expect(screen.queryByTestId('aarti-mode')).toBeNull();
    expect(useTabBarStore.getState().hidden).toBe(false);
    expect(player.remove).toHaveBeenCalled();
    expect(useAartiPlayerStore.getState().track).toBeNull();
  });

  it('a finished aarti with too few circles is not complete; the circles can still be made afterwards', async () => {
    await renderHome();
    const player = await openAarti();
    await emit(player, { currentTime: 30, didJustFinish: true, playing: false }); // screen was locked, manual mode
    expect(screen.queryByText('आरती सम्पन्न 🙏')).toBeNull();
    expect(calls('/mandir/rituals/aarti-complete')).toHaveLength(0);

    await fireEvent.press(screen.getByRole('switch', { name: 'थाली अपने आप घुमाएं' }));
    await act(async () => jest.advanceTimersByTime(9100));
    expect(await screen.findByText('आरती सम्पन्न 🙏')).toBeTruthy();
    expect(calls('/mandir/rituals/aarti-complete')[0][1]).toMatchObject({ body: { playedRatio: 1, circles: 3 } });
  });

  it('a failed save shows retry, which reuses the same Idempotency-Key', async () => {
    let fail = true;
    await renderHome({
      routes: {
        '/mandir/rituals/aarti-complete': () =>
          fail ? Promise.reject(new ApiError(0, 'NETWORK_ERROR', 'offline')) : Promise.resolve(aartiCompleteResponse()),
      },
    });
    const player = await openAarti();
    await fireEvent.press(screen.getByRole('switch', { name: 'थाली अपने आप घुमाएं' }));
    await emit(player, { currentTime: 29 });
    await act(async () => jest.advanceTimersByTime(9100));

    const card = await screen.findByTestId('aarti-complete');
    expect(await within(card).findByText('इंटरनेट से जुड़ें')).toBeTruthy();
    fail = false;
    await fireEvent.press(within(card).getByText('फिर से कोशिश करें'));
    expect(await screen.findByText('🔥 6 दिन की साधना')).toBeTruthy();
    const keys = calls('/mandir/rituals/aarti-complete').map(([, o]) => (o as Opts).idempotencyKey);
    expect(keys).toHaveLength(2);
    expect(keys[0]).toBe(keys[1]);
  });

  it('close before completion asks first; leaving stops the audio', async () => {
    await renderHome();
    const player = await openAarti();
    await emit(player, { currentTime: 15 });
    await fireEvent.press(screen.getByLabelText('आरती बंद करें'));
    const confirm = await screen.findByTestId('aarti-confirm-close');
    await fireEvent.press(within(confirm).getByText('आरती जारी रखें'));
    await waitFor(() => expect(screen.queryByTestId('aarti-confirm-close')).toBeNull());
    expect(screen.getByTestId('aarti-mode')).toBeTruthy();

    await fireEvent.press(screen.getByLabelText('आरती बंद करें'));
    await fireEvent.press(within(await screen.findByTestId('aarti-confirm-close')).getByText('बंद करें'));
    expect(screen.queryByTestId('aarti-mode')).toBeNull();
    expect(player.clearLockScreenControls).toHaveBeenCalled();
    expect(events).toContainEqual({ event: 'aarti_abandoned', props: { playedRatio: 0.5 } });
    expect(screen.getByLabelText('फूल')).toBeTruthy(); // VM-01 controls back
  });

  it('switching aarti restarts the audio with the other aarti', async () => {
    await renderHome();
    const first = await openAarti();
    await fireEvent.press(screen.getByRole('radio', { name: CHALISA.titleHi }));
    await waitFor(() => expect(create).toHaveBeenLastCalledWith({ uri: CHALISA.audioUrl }, { updateInterval: 250 }));
    expect(first.remove).toHaveBeenCalled();
    expect(screen.getByRole('radio', { name: CHALISA.titleHi })).toHaveProp('accessibilityState', { selected: true });
  });
});

describe('VM-06 thali picker (mandir.thali_designs)', () => {
  it('shows every design; locked ones with their coin cost', async () => {
    await renderHome();
    await openAarti();
    const picker = await screen.findByTestId('thali-picker');
    expect(await within(picker).findByLabelText('पीतल की थाली')).toHaveProp('accessibilityState', { selected: true });
    expect(within(picker).getByLabelText('चाँदी की थाली, 51 सिक्कों में अनलॉक करें')).toBeTruthy();
    expect(within(picker).getByText('51')).toBeTruthy();
    expect(within(picker).getByText('108')).toBeTruthy();
    expect(events).toContainEqual({ event: 'thali_picker_opened', props: {} });
  });

  it('selects an unlocked design at once (PUT /mandir/thali)', async () => {
    await renderHome({ routes: { '/mandir/thalis': () => Promise.resolve(thalisPayload({ unlocked: [CHAANDI] })) } });
    await openAarti();
    const picker = await screen.findByTestId('thali-picker');
    await fireEvent.press(await within(picker).findByLabelText('चाँदी की थाली'));
    await waitFor(() => expect(calls('/mandir/thali')).toHaveLength(1));
    expect(calls('/mandir/thali')[0][1]).toMatchObject({ method: 'PUT', body: { thaliId: CHAANDI } });
    await waitFor(() => expect(within(picker).getByLabelText('चाँदी की थाली')).toHaveProp('accessibilityState', { selected: true }));
    expect(events).toContainEqual({ event: 'thali_selected', props: { thaliId: CHAANDI } });
  });

  it('a failed select puts the previous thali back', async () => {
    await renderHome({
      routes: {
        '/mandir/thalis': () => Promise.resolve(thalisPayload({ unlocked: [CHAANDI] })),
        '/mandir/thali': () => Promise.reject(new ApiError(403, 'THALI_LOCKED', 'locked', { thaliId: CHAANDI })),
      },
    });
    await openAarti();
    const picker = await screen.findByTestId('thali-picker');
    await fireEvent.press(await within(picker).findByLabelText('चाँदी की थाली'));
    await waitFor(() => expect(toast()).toBe('यह थाली अभी उपलब्ध नहीं है'));
    expect(within(picker).getByLabelText('पीतल की थाली')).toHaveProp('accessibilityState', { selected: true });
  });

  it('unlock: confirm sheet → POST with Idempotency-Key → coins from the server → selected', async () => {
    let answer!: (v: unknown) => void;
    await renderHome({ home: RICH(), routes: { unlock: () => new Promise((r) => (answer = r)) } });
    await openAarti();
    const picker = await screen.findByTestId('thali-picker');
    await fireEvent.press(await within(picker).findByLabelText('चाँदी की थाली, 51 सिक्कों में अनलॉक करें'));

    const sheet = await screen.findByTestId('unlock-thali-sheet');
    expect(within(sheet).getByText('आपके पास 60 सिक्के हैं')).toBeTruthy();
    await fireEvent.press(within(sheet).getByText('अनलॉक करें — 51 सिक्के'));
    await fireEvent.press(await within(sheet).findByRole('button', { busy: true })); // double tap while waiting
    const unlocks = api.mock.calls.filter(([p]) => p === `/mandir/thalis/${CHAANDI}/unlock`);
    expect(unlocks).toHaveLength(1);
    expect(unlocks[0][1]).toMatchObject({ method: 'POST' });
    expect((unlocks[0][1] as Opts).idempotencyKey).toMatch(UUID);

    await act(async () => answer({ thaliId: CHAANDI, coinsSpent: 51, coinsBalance: 9 }));
    await waitFor(() => expect(screen.queryByTestId('unlock-thali-sheet')).toBeNull());
    expect(await screen.findByLabelText('9 सिक्के')).toBeTruthy();
    expect(toast()).toBe('चाँदी की थाली अनलॉक हो गई 🙏');
    await waitFor(() => expect(calls('/mandir/thali')[0][1]).toMatchObject({ body: { thaliId: CHAANDI } }));
    await waitFor(() => expect(within(picker).getByLabelText('चाँदी की थाली')).toHaveProp('accessibilityState', { selected: true }));
    expect(events).toContainEqual({ event: 'thali_unlocked', props: { thaliId: CHAANDI, coins: 51 } });
  });

  it('a lost unlock answer is retried with the same key', async () => {
    let attempt = 0;
    await renderHome({
      home: RICH(),
      routes: {
        unlock: () =>
          ++attempt === 1
            ? Promise.reject(new ApiError(0, 'NETWORK_ERROR', 'offline'))
            : Promise.resolve({ thaliId: CHAANDI, coinsSpent: 51, coinsBalance: 0 }),
      },
    });
    await openAarti();
    const picker = await screen.findByTestId('thali-picker');
    await fireEvent.press(await within(picker).findByLabelText('चाँदी की थाली, 51 सिक्कों में अनलॉक करें'));
    const sheet = await screen.findByTestId('unlock-thali-sheet');
    await fireEvent.press(within(sheet).getByText('अनलॉक करें — 51 सिक्के'));
    await waitFor(() => expect(toast()).toBe('इंटरनेट से जुड़ें'));
    expect(screen.getByTestId('unlock-thali-sheet')).toBeTruthy();
    await fireEvent.press(within(sheet).getByText('अनलॉक करें — 51 सिक्के'));
    await waitFor(() => expect(screen.queryByTestId('unlock-thali-sheet')).toBeNull());
    const keys = api.mock.calls.filter(([p]) => p === `/mandir/thalis/${CHAANDI}/unlock`).map(([, o]) => (o as Opts).idempotencyKey);
    expect(keys).toHaveLength(2);
    expect(keys[0]).toBe(keys[1]);
  });

  it('too few coins → coin sheet without calling the API; a 402 opens it with the server numbers', async () => {
    await renderHome({
      home: RICH(),
      routes: { unlock: () => Promise.reject(new ApiError(402, 'COINS_INSUFFICIENT', 'no coins', { required: 51, balance: 10 })) },
    });
    await openAarti();
    const picker = await screen.findByTestId('thali-picker');
    await fireEvent.press(await within(picker).findByLabelText('सोने की थाली, 108 सिक्कों में अनलॉक करें'));
    const coins = await screen.findByTestId('coins-needed-sheet');
    expect(within(coins).getByText('आपको 48 सिक्के और चाहिए')).toBeTruthy();
    expect(api.mock.calls.filter(([p]) => String(p).endsWith('/unlock'))).toHaveLength(0);
    await fireEvent.press(within(coins).getByLabelText('बंद करें', { exact: true }));
    await waitFor(() => expect(screen.queryByTestId('coins-needed-sheet')).toBeNull());

    await fireEvent.press(within(picker).getByLabelText('चाँदी की थाली, 51 सिक्कों में अनलॉक करें'));
    await fireEvent.press(within(await screen.findByTestId('unlock-thali-sheet')).getByText('अनलॉक करें — 51 सिक्के'));
    expect(await within(await screen.findByTestId('coins-needed-sheet')).findByText('आपको 41 सिक्के और चाहिए')).toBeTruthy();
  });

  it('409 ALREADY_UNLOCKED counts as unlocked', async () => {
    await renderHome({ home: RICH(), routes: { unlock: () => Promise.reject(new ApiError(409, 'ALREADY_UNLOCKED', 'dup', { thaliId: CHAANDI })) } });
    await openAarti();
    const picker = await screen.findByTestId('thali-picker');
    await fireEvent.press(await within(picker).findByLabelText('चाँदी की थाली, 51 सिक्कों में अनलॉक करें'));
    await fireEvent.press(within(await screen.findByTestId('unlock-thali-sheet')).getByText('अनलॉक करें — 51 सिक्के'));
    await waitFor(() => expect(calls('/mandir/thali')).toHaveLength(1));
    expect(within(picker).getByLabelText('चाँदी की थाली')).toBeTruthy();
  });

  it('flag off: no picker and no thali request', async () => {
    await renderHome({ flags: { ...ALL_ON, [MandirFlag.THALI_DESIGNS]: false } });
    await openAarti();
    expect(screen.queryByTestId('thali-picker')).toBeNull();
    expect(calls('/mandir/thalis')).toHaveLength(0);
  });
});

describe('VM-01 Listen', () => {
  it('plays the default aarti in the background and stops on a second tap', async () => {
    await renderHome();
    await fireEvent.press(screen.getByLabelText('सुनें'));
    await waitFor(() => expect(useAartiPlayerStore.getState()).toMatchObject({ mode: 'listen', track: { aartiId: DEFAULT_AARTI.id } }));
    const player = lastPlayer();
    expect(player.setActiveForLockScreen).toHaveBeenCalled();
    expect(screen.queryByTestId('aarti-mode')).toBeNull();

    await fireEvent.press(await screen.findByLabelText('आरती सुनना बंद करें'));
    expect(player.remove).toHaveBeenCalled();
    expect(screen.getByLabelText('सुनें')).toBeTruthy();
  });
});
