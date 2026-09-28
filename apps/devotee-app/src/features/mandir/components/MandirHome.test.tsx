import { MandirFlag } from '@mandir/shared-types';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { State } from 'react-native-gesture-handler';
import { fireGestureHandler, getByGestureTestId } from 'react-native-gesture-handler/jest-utils';

import { ApiError, apiRequest } from '@/api/client';
import { useConnectivityStore } from '@/api/connectivity';
import { queryKeys } from '@/api/keys';
import { useSettingsStore } from '@/features/settings/store';
import { setAnalyticsSink } from '@/lib/analytics';
import { impactMedium } from '@/lib/haptics';
import { getPreference, resetPreferencesCache, setPreference } from '@/lib/storage';
import { configWith, createTestQueryClient, homePayload, withQueryClient } from '@/test/mandir-fixtures';

import { useGreetingStore } from '../hooks/useFirstVisitOfDay';
import { playBell, playShankh } from '../sounds';
import { useDeitySelectionStore } from '../store/selection';
import { MandirHome } from './MandirHome';

jest.mock('@/api/client', () => ({ ...jest.requireActual('@/api/client'), apiRequest: jest.fn() }));
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
const ALL_ON = Object.fromEntries(Object.values(MandirFlag).map((k) => [k, true]));

type Routes = Record<string, () => Promise<unknown>>;
function mockApi(routes: Routes) {
  api.mockImplementation((path: string) => {
    const handler = routes[path];
    return (handler ? handler() : Promise.reject(new Error(`unmocked ${path}`))) as never;
  });
}

async function renderHome(routes: Routes, flags: Record<string, boolean> = ALL_ON) {
  const client = createTestQueryClient();
  // ConfigGate loads the config before any route renders.
  client.setQueryData(queryKeys.config, configWith(flags));
  mockApi(routes);
  await render(<MandirHome />, { wrapper: withQueryClient(client) });
  // The scene is laid out once its size is known (loading state included).
  const scene = screen.queryByTestId('mandir-scene');
  if (scene) await fireEvent(scene, 'layout', { nativeEvent: { layout: { width: 360, height: 600, x: 0, y: 0 } } });
  return client;
}

beforeEach(() => {
  useConnectivityStore.setState({ offline: false });
  api.mockReset();
  jest.clearAllMocks();
  useDeitySelectionStore.setState({ selectedDeityId: null });
  useSettingsStore.setState({ startupShankh: true });
  useGreetingStore.setState({ glowDate: null });
  jest.requireMock('expo-file-system').__files.clear();
  resetPreferencesCache();
});

describe('VM-01 Mandir Home', () => {
  it('renders all zones from /mandir/home', async () => {
    await renderHome({ '/mandir/home': () => Promise.resolve(homePayload()) });

    // top bar: profile, day chip, coin pill, carousel (+ add)
    expect(await screen.findByText('मंगलवार दिव्य दर्शन')).toBeTruthy();
    expect(screen.getByLabelText('प्रोफ़ाइल')).toBeTruthy();
    expect(screen.getByText('42')).toBeTruthy();
    expect(screen.getByLabelText('हनुमान जी')).toHaveProp('accessibilityState', { selected: true });
    expect(screen.getByLabelText('शिव जी')).toHaveProp('accessibilityState', { selected: false });
    expect(screen.getByLabelText('देवता जोड़ें')).toBeTruthy();
    // garbhagriha + bells, tithi strip
    expect(screen.getByLabelText('हनुमान जी के दर्शन')).toBeTruthy();
    expect(screen.getAllByLabelText('घंटी बजाएं')).toHaveLength(2);
    expect(screen.getByText('॥ मंगलवार, आश्विन कृष्ण पक्ष तृतीया ॥')).toBeTruthy();
    // rail
    for (const label of ['फूल', 'माला', 'दीया', 'भोग', 'संग्रह']) {
      expect(screen.getByLabelText(label)).toHaveProp('accessibilityState', { disabled: false });
    }
    // thali, special offering, listen
    expect(screen.getByLabelText('आरती करें')).toBeTruthy();
    expect(screen.getByText('सिंदूर चढ़ाएं')).toBeTruthy();
    expect(screen.getByLabelText('सुनें')).toBeTruthy();
    expect(screen.queryByText('इंटरनेट कनेक्शन नहीं है')).toBeNull();
  });

  it('shows the layout with a shimmer and disabled controls while loading', async () => {
    await renderHome({ '/mandir/home': () => new Promise(() => {}) });

    expect(screen.getByTestId('mandir-scene')).toBeTruthy();
    for (const label of ['फूल', 'संग्रह']) {
      expect(screen.getByLabelText(label)).toHaveProp('accessibilityState', { disabled: true });
    }
    expect(screen.queryByText('मंगलवार दिव्य दर्शन')).toBeNull();
    expect(screen.getByText('–')).toBeTruthy(); // coin pill placeholder
  });

  it('shows an error with retry when home cannot load', async () => {
    let calls = 0;
    await renderHome({
      '/mandir/home': () => {
        calls += 1;
        return calls === 1 ? Promise.reject(new ApiError(500, 'INTERNAL', 'boom')) : Promise.resolve(homePayload());
      },
    });
    expect(await screen.findByText('कुछ गलत हो गया')).toBeTruthy();

    await fireEvent.press(screen.getByText('फिर से कोशिश करें'));
    expect(await screen.findByText('मंगलवार दिव्य दर्शन')).toBeTruthy();
  });

  it('keeps the last scene and shows the offline banner when a refresh cannot reach the server', async () => {
    let online = true;
    const client = await renderHome({
      '/mandir/home': () =>
        online ? Promise.resolve(homePayload()) : Promise.reject(new ApiError(0, 'NETWORK_ERROR', 'offline')),
    });
    await screen.findByText('मंगलवार दिव्य दर्शन');
    online = false;
    await act(async () => {
      await client.refetchQueries({ queryKey: queryKeys.mandirHome }).catch(() => undefined);
    });

    expect(await screen.findByText('इंटरनेट कनेक्शन नहीं है')).toBeTruthy();
    expect(screen.getByLabelText('हनुमान जी के दर्शन')).toBeTruthy();
  });

  it('hides the offering buttons when mandir.offerings is off', async () => {
    await renderHome(
      { '/mandir/home': () => Promise.resolve(homePayload()) },
      { ...ALL_ON, [MandirFlag.OFFERINGS]: false },
    );
    await screen.findByText('मंगलवार दिव्य दर्शन');
    expect(screen.queryByLabelText('फूल')).toBeNull();
    expect(screen.getByLabelText('संग्रह')).toBeTruthy();
  });

  it('shows the disabled message when mandir.enabled is off', async () => {
    await renderHome({}, { ...ALL_ON, [MandirFlag.ENABLED]: false });
    expect(await screen.findByText('मंदिर अभी उपलब्ध नहीं है')).toBeTruthy();
    expect(api).not.toHaveBeenCalledWith('/mandir/home', expect.anything());
  });

  describe('VM-02 deity switching', () => {
    const loaded = async () => {
      await renderHome({ '/mandir/home': () => Promise.resolve(homePayload()) });
      await screen.findByLabelText('हनुमान जी के दर्शन');
    };

    it('switches on a carousel tap', async () => {
      await loaded();
      await fireEvent.press(screen.getByLabelText('शिव जी'));
      expect(screen.getByLabelText('शिव जी के दर्शन')).toBeTruthy();
      expect(screen.getByLabelText('शिव जी')).toHaveProp('accessibilityState', { selected: true });
    });

    it('swipes left to the next deity and right to the previous one, wrapping around', async () => {
      await loaded();
      const swipe = async (translationX: number) =>
        act(() =>
          fireGestureHandler(getByGestureTestId('mandir-swipe'), [
            { state: State.BEGAN, translationX: 0 },
            { state: State.ACTIVE, translationX: translationX / 2 },
            { state: State.END, translationX, velocityX: 0 },
          ]),
        );
      await swipe(-120);
      expect(screen.getByLabelText('शिव जी के दर्शन')).toBeTruthy();
      await swipe(120);
      await swipe(120);
      expect(screen.getByLabelText('गणेश जी के दर्शन')).toBeTruthy(); // wrapped from the first to the last
      await swipe(20); // too short: no switch
      expect(screen.getByLabelText('गणेश जी के दर्शन')).toBeTruthy();
    });

    it('switches with the screen reader adjust actions', async () => {
      await loaded();
      const scene = screen.getByTestId('mandir-garbhagriha');
      await fireEvent(scene, 'accessibilityAction', { nativeEvent: { actionName: 'increment' } });
      expect(screen.getByLabelText('शिव जी के दर्शन')).toBeTruthy();
      await fireEvent(scene, 'accessibilityAction', { nativeEvent: { actionName: 'decrement' } });
      expect(screen.getByLabelText('हनुमान जी के दर्शन')).toBeTruthy();
    });

    it('opens Sangrah from the carousel + and the rail', async () => {
      const { router } = jest.requireMock('expo-router');
      await loaded();
      await fireEvent.press(screen.getByLabelText('देवता जोड़ें'));
      await fireEvent.press(screen.getByLabelText('संग्रह'));
      expect(router.push).toHaveBeenCalledTimes(2);
      expect(router.push).toHaveBeenCalledWith('/sangrah');
    });
  });

  describe('T11 bells', () => {
    it('rings with sound and haptic on each tap and logs bell_rung at most once a minute', async () => {
      const events: string[] = [];
      const restore = setAnalyticsSink((e) => events.push(e));
      await renderHome({ '/mandir/home': () => Promise.resolve(homePayload()) });
      await screen.findByLabelText('हनुमान जी के दर्शन');

      const [left, right] = screen.getAllByLabelText('घंटी बजाएं');
      await fireEvent.press(left);
      await fireEvent.press(right);
      await fireEvent.press(left);
      expect(playBell).toHaveBeenNthCalledWith(1, 'left');
      expect(playBell).toHaveBeenNthCalledWith(2, 'right');
      expect(playBell).toHaveBeenCalledTimes(3);
      expect(impactMedium).toHaveBeenCalledTimes(3);
      expect(events.filter((e) => e === 'bell_rung')).toHaveLength(1);
      restore();
    });

    it('keeps the bells disabled while loading', async () => {
      await renderHome({ '/mandir/home': () => new Promise(() => {}) });
      for (const bell of screen.getAllByLabelText('घंटी बजाएं')) await fireEvent.press(bell);
      expect(playBell).not.toHaveBeenCalled();
    });
  });

  describe('VM-01 first visit of the day', () => {
    const open = async (flags: Record<string, boolean> = ALL_ON) => {
      await renderHome({ '/mandir/home': () => Promise.resolve(homePayload()) }, flags);
      await screen.findByLabelText('हनुमान जी के दर्शन');
    };

    it('plays the shankh and shows the "आज का दर्शन" glow once per local day', async () => {
      await open();
      expect(playShankh).toHaveBeenCalledTimes(1);
      expect(screen.getByTestId('today-darshan-glow')).toBeTruthy();
      expect(screen.getByText('✨ आज का दर्शन ✨')).toBeTruthy();
      expect(getPreference('mandir.lastVisitDate', null)).toBe('2026-09-29');
      // the glow plays once, then goes away
      await act(async () => {
        await new Promise((r) => setTimeout(r, 4100));
      });
      expect(screen.queryByTestId('today-darshan-glow')).toBeNull();

      await screen.unmount();
      await open(); // same day again
      expect(playShankh).toHaveBeenCalledTimes(1);
      expect(screen.queryByTestId('today-darshan-glow')).toBeNull();
    });

    it('greets again on a new day', async () => {
      setPreference('mandir.lastVisitDate', '2026-09-28');
      await open();
      expect(playShankh).toHaveBeenCalledTimes(1);
      expect(screen.getByTestId('today-darshan-glow')).toBeTruthy();
    });

    it('shows only the glow when mandir.startup_shankh_sound is off or the user turned the shankh off', async () => {
      await open({ ...ALL_ON, [MandirFlag.STARTUP_SHANKH_SOUND]: false });
      expect(screen.getByTestId('today-darshan-glow')).toBeTruthy();
      await screen.unmount();

      setPreference('mandir.lastVisitDate', null);
      useSettingsStore.setState({ startupShankh: false });
      await open();
      expect(screen.getByTestId('today-darshan-glow')).toBeTruthy();
      expect(playShankh).not.toHaveBeenCalled();
    });

    it('waits for the scene before greeting', async () => {
      await renderHome({ '/mandir/home': () => new Promise(() => {}) });
      expect(playShankh).not.toHaveBeenCalled();
      expect(getPreference('mandir.lastVisitDate', null)).toBeNull();
    });
  });
});
