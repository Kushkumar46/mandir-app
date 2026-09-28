import { MandirFlag } from '@mandir/shared-types';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react-native';

import { ApiError, apiRequest } from '@/api/client';
import { queryKeys } from '@/api/keys';
import { useToastStore } from '@/features/shell/Toast';
import { setAnalyticsSink } from '@/lib/analytics';
import {
  configWith,
  createTestQueryClient,
  HANUMAN,
  homePayload,
  offeringResponse,
  offeringsPayload,
  withQueryClient,
} from '@/test/mandir-fixtures';

import { useGreetingStore } from '../../hooks/useFirstVisitOfDay';
import { resetOfferingStore, useOfferingStore } from '../../store/offerings';
import { useDeitySelectionStore } from '../../store/selection';
import { MandirHome } from '../MandirHome';

jest.mock('@/api/client', () => ({ ...jest.requireActual('@/api/client'), apiRequest: jest.fn() }));
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
const ALL_ON = Object.fromEntries(Object.values(MandirFlag).map((k) => [k, true]));
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

type Handler = (opts: { body?: unknown; idempotencyKey?: string }) => Promise<unknown>;

async function renderHome(post: Handler, home = homePayload()) {
  const client = createTestQueryClient();
  client.setQueryData(queryKeys.config, configWith(ALL_ON));
  api.mockImplementation(((path: string, opts: { body?: unknown; idempotencyKey?: string }) => {
    if (path === '/mandir/home') return Promise.resolve(home);
    if (path === `/deities/${HANUMAN}/offerings`) return Promise.resolve(offeringsPayload());
    if (path === '/mandir/offerings') return post(opts);
    return Promise.reject(new Error(`unmocked ${path}`));
  }) as never);
  await render(<MandirHome />, { wrapper: withQueryClient(client) });
  await fireEvent(screen.getByTestId('mandir-scene'), 'layout', { nativeEvent: { layout: { width: 360, height: 600, x: 0, y: 0 } } });
  await screen.findByLabelText('हनुमान जी के दर्शन');
  return client;
}

const posts = () => api.mock.calls.filter(([path]) => path === '/mandir/offerings');
const coinPill = () => screen.getByLabelText(/सिक्के। सिक्के देखें$/);
const toast = () => useToastStore.getState().toast?.message;

async function openSheet(rail: string) {
  await fireEvent.press(screen.getByLabelText(rail));
  return screen.findByTestId('offering-sheet');
}

let events: { event: string; props: Record<string, unknown> }[] = [];
let restoreAnalytics: () => void;

beforeEach(() => {
  api.mockReset();
  resetOfferingStore();
  useDeitySelectionStore.setState({ selectedDeityId: null });
  useGreetingStore.setState({ glowDate: null });
  useToastStore.setState({ toast: null });
  events = [];
  restoreAnalytics = setAnalyticsSink((event, props) => events.push({ event, props }));
});
afterEach(() => restoreAnalytics());

describe('VM-05 offering sheet', () => {
  it('lists the kind’s items with free / coin prices', async () => {
    await renderHome(() => Promise.resolve(offeringResponse()));
    const sheet = await openSheet('फूल');

    expect(within(sheet).getByText('फूल चढ़ाएं')).toBeTruthy();
    expect(within(sheet).getByText('आपके सिक्के: 42')).toBeTruthy();
    expect(within(sheet).getByLabelText('गेंदा फूल, निःशुल्क')).toBeTruthy();
    expect(within(sheet).getByLabelText('गुलाब, 5 सिक्के')).toBeTruthy();
    expect(within(sheet).queryByText('गुलाब की माला')).toBeNull(); // other kinds stay out
    expect(events).toContainEqual({ event: 'offering_sheet_opened', props: { kind: 'FLOWER' } });

    await fireEvent.press(within(sheet).getByLabelText('बंद करें', { exact: true }));
    await waitFor(() => expect(screen.queryByTestId('offering-sheet')).toBeNull());
  });

  it('opens the special items from the deity-special badge', async () => {
    await renderHome(() => Promise.resolve(offeringResponse()));
    await fireEvent.press(screen.getByText('सिंदूर चढ़ाएं'));
    const sheet = await screen.findByTestId('offering-sheet');
    expect(within(sheet).getByText('विशेष चढ़ावा')).toBeTruthy();
    expect(within(sheet).getByLabelText('सिंदूर, निःशुल्क')).toBeTruthy();
    expect(within(sheet).getByLabelText('चुनरी, 51 सिक्के')).toBeTruthy();
  });

  it('free: plays the falling flowers at once, logs in the background and updates from the answer', async () => {
    let answer!: (v: unknown) => void;
    await renderHome(() => new Promise((r) => (answer = r)));
    const sheet = await openSheet('फूल');
    await fireEvent.press(within(sheet).getByLabelText('गेंदा फूल, निःशुल्क'));

    // animation before the server answered; sheet closed
    expect(await screen.findByTestId('particle-shower')).toBeTruthy();
    expect(screen.queryByTestId('offering-sheet')).toBeNull();
    const opts = posts()[0][1] as unknown as { body: unknown; idempotencyKey: string; method: string };
    expect(opts).toMatchObject({ method: 'POST', body: { deityId: HANUMAN, offeringItemId: offeringsPayload().groups[0].items[0].id } });
    expect(opts.idempotencyKey).toMatch(UUID);

    await act(async () => {
      answer(
        offeringResponse({
          coinsBalance: 43,
          rewards: [{ ruleKey: 'FIRST_DARSHAN_OF_DAY', coins: 1 }],
          reward: { ruleKey: 'FIRST_DARSHAN_OF_DAY', coins: 1 },
          todayOfferings: { flowers: 15, mala: true, diya: true, bhog: false },
        }),
      );
    });
    await waitFor(() => expect(coinPill()).toHaveTextContent(/[^0-9]43$/));
    expect(toast()).toBe('🎉 +1 सिक्का मिला — आज का पहला दर्शन');
    expect(events).toContainEqual({ event: 'offering_made', props: { itemId: expect.any(String), kind: 'FLOWER', coins: 0 } });
  });

  it('keeps the pile as it was until the flowers have landed', async () => {
    await renderHome(() => Promise.resolve(offeringResponse({ todayOfferings: { flowers: 31, mala: true, diya: true, bhog: false } })));
    expect(screen.getAllByTestId('pile-flower')).toHaveLength(6); // 14 flowers → stage 2
    const sheet = await openSheet('फूल');
    await fireEvent.press(within(sheet).getByLabelText('गेंदा फूल, निःशुल्क'));
    await waitFor(() => expect(posts()).toHaveLength(1));
    expect(coinPill()).toHaveTextContent(/[^0-9]42$/);
    expect(screen.getAllByTestId('pile-flower')).toHaveLength(6);

    await act(async () => {
      const active = useOfferingStore.getState().active!;
      useOfferingStore.getState().finish(active.id); // the shower's onDone
    });
    expect(screen.queryByTestId('particle-shower')).toBeNull();
    expect(screen.getAllByTestId('pile-flower')).toHaveLength(10); // 31 flowers → stage 3
  });

  it('free: a failed log (429 / offline) keeps the animation and shows nothing', async () => {
    await renderHome(() => Promise.reject(new ApiError(429, 'RATE_LIMITED', 'slow down', {}, 30)));
    const sheet = await openSheet('माला');
    await fireEvent.press(within(sheet).getByLabelText('गेंदे की माला, निःशुल्क'));
    expect(await screen.findByTestId('anim-mala')).toBeTruthy();
    await waitFor(() => expect(posts()).toHaveLength(1));
    expect(toast()).toBeUndefined();
  });

  it('paid: calls the API first, then animates and shows the new balance', async () => {
    let answer!: (v: unknown) => void;
    await renderHome(() => new Promise((r) => (answer = r)));
    const sheet = await openSheet('दीया');
    await fireEvent.press(within(sheet).getByLabelText('पंचदीप, 11 सिक्के'));

    // waiting: spinner on the card, sheet still open, no animation yet — a second tap is ignored
    expect(within(sheet).getByLabelText('पंचदीप, 11 सिक्के')).toHaveProp('accessibilityState', { disabled: true, busy: true });
    await fireEvent.press(within(sheet).getByLabelText('पंचदीप, 11 सिक्के'));
    await fireEvent.press(within(sheet).getByLabelText('मिट्टी का दीया, निःशुल्क'));
    expect(posts()).toHaveLength(1);
    expect(screen.queryByTestId('anim-diya')).toBeNull();

    await act(async () => answer(offeringResponse({ coinsBalance: 31, coinsSpent: 11 })));
    expect(await screen.findByTestId('anim-diya')).toBeTruthy();
    expect(screen.queryByTestId('offering-sheet')).toBeNull();
    expect(coinPill()).toHaveTextContent(/[^0-9]31$/);
    expect(events).toContainEqual({ event: 'offering_made', props: { itemId: expect.any(String), kind: 'DIYA', coins: 11 } });
  });

  it('paid with too few coins opens the coin sheet without calling the API', async () => {
    await renderHome(() => Promise.resolve(offeringResponse()));
    await fireEvent.press(screen.getByText('सिंदूर चढ़ाएं'));
    const special = await screen.findByTestId('offering-sheet');
    await fireEvent.press(within(special).getByLabelText('चुनरी, 51 सिक्के'));

    const coins = await screen.findByTestId('coins-needed-sheet');
    expect(within(coins).getByText('आपको 9 सिक्के और चाहिए')).toBeTruthy();
    expect(within(coins).getByText('आपके पास 42 सिक्के हैं')).toBeTruthy();
    expect(posts()).toHaveLength(0);
    expect(events).toContainEqual({ event: 'offering_blocked', props: { reason: 'COINS_INSUFFICIENT' } });

    await fireEvent.press(within(coins).getByText('सिक्के खरीदें'));
    expect(toast()).toBe('यह सुविधा जल्द आ रही है'); // VM-07 comes with T15
  });

  it('paid: a 402 from the server opens the coin sheet with its numbers', async () => {
    await renderHome(() => Promise.reject(new ApiError(402, 'COINS_INSUFFICIENT', 'no coins', { required: 21, balance: 2 })));
    const sheet = await openSheet('भोग');
    await fireEvent.press(within(sheet).getByLabelText('छप्पन भोग, 21 सिक्के'));
    const coins = await screen.findByTestId('coins-needed-sheet');
    expect(within(coins).getByText('आपको 19 सिक्के और चाहिए')).toBeTruthy();
    expect(screen.queryByTestId('anim-bhog')).toBeNull();
  });

  it('paid without internet shows "इंटरनेट से जुड़ें" and plays nothing', async () => {
    await renderHome(() => Promise.reject(new ApiError(0, 'NETWORK_ERROR', 'offline')));
    const sheet = await openSheet('माला');
    await fireEvent.press(within(sheet).getByLabelText('गुलाब की माला, 11 सिक्के'));
    await waitFor(() => expect(toast()).toBe('इंटरनेट से जुड़ें'));
    expect(screen.queryByTestId('anim-mala')).toBeNull();
    // the sheet stays open and usable again
    expect(within(sheet).getByLabelText('गुलाब की माला, 11 सिक्के')).toHaveProp('accessibilityState', { disabled: false, busy: false });
  });

  it('shows new badges in the reward toast', async () => {
    await renderHome(() =>
      Promise.resolve(
        offeringResponse({
          coinsBalance: 53,
          rewards: [
            { ruleKey: 'FIRST_DARSHAN_OF_DAY', coins: 1 },
            { ruleKey: 'STREAK_7', coins: 10 },
          ],
          badgesEarned: ['STREAK_7'],
        }),
      ),
    );
    const sheet = await openSheet('भोग');
    await fireEvent.press(within(sheet).getByLabelText('मिश्री भोग, निःशुल्क'));
    await waitFor(() => expect(toast()).toBe('🎉 +11 सिक्के मिले\n🏅 नया बैज: सप्त दिवस भक्त'));
    expect(events).toContainEqual({ event: 'streak_badge_earned', props: { badge: 'STREAK_7' } });
  });

  it('draws the special animations: tilak and chunari', async () => {
    await renderHome(() => Promise.resolve(offeringResponse({ coinsBalance: 100 })), homePayload({ coins: { balance: 100 } }));
    await fireEvent.press(screen.getByText('सिंदूर चढ़ाएं'));
    await fireEvent.press(within(await screen.findByTestId('offering-sheet')).getByLabelText('सिंदूर, निःशुल्क'));
    expect(await screen.findByTestId('anim-tilak')).toBeTruthy();

    await fireEvent.press(screen.getByText('सिंदूर चढ़ाएं'));
    await fireEvent.press(within(await screen.findByTestId('offering-sheet')).getByLabelText('चुनरी, 51 सिक्के'));
    expect(await screen.findByTestId('anim-drape')).toBeTruthy();
    expect(screen.queryByTestId('anim-tilak')).toBeNull(); // one animation at a time
  });

  it('switching deity ends the running animation', async () => {
    await renderHome(() => Promise.resolve(offeringResponse()));
    const sheet = await openSheet('माला');
    await fireEvent.press(within(sheet).getByLabelText('गेंदे की माला, निःशुल्क'));
    expect(await screen.findByTestId('anim-mala')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('शिव जी'));
    await waitFor(() => expect(useOfferingStore.getState().active).toBeNull());
    await fireEvent.press(screen.getByLabelText('हनुमान जी'));
    expect(screen.queryByTestId('anim-mala')).toBeNull();
  });
});
