import { MandirFlag } from '@mandir/shared-types';
import { act, fireEvent, render, screen } from '@testing-library/react-native';

import { ApiError, apiRequest } from '@/api/client';
import { queryKeys } from '@/api/keys';
import { configWith, createTestQueryClient, homePayload, withQueryClient } from '@/test/mandir-fixtures';

import { MandirHome } from './MandirHome';

jest.mock('@/api/client', () => ({ ...jest.requireActual('@/api/client'), apiRequest: jest.fn() }));
jest.mock('expo-router', () => {
  const { useEffect } = jest.requireActual('react');
  return {
    router: { navigate: jest.fn(), push: jest.fn() },
    useFocusEffect: (cb: () => void | (() => void)) => useEffect(cb, [cb]),
  };
});

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

beforeEach(() => api.mockReset());

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
});
