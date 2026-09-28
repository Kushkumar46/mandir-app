import type { DeityListItem, MandirHome, SetMandirDeitiesRequest } from '@mandir/shared-types';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import { ApiError, apiRequest } from '@/api/client';
import { queryKeys } from '@/api/keys';
import { applyDeityListToHome } from '@/api/mandir';
import { useToastStore } from '@/features/shell/Toast';
import { createTestQueryClient, GANESH, HANUMAN, homePayload, SHIV, uuid, withQueryClient } from '@/test/mandir-fixtures';

import { SangrahScreen } from './SangrahScreen';

jest.mock('@/api/client', () => ({ ...jest.requireActual('@/api/client'), apiRequest: jest.fn() }));
jest.mock('expo-router', () => ({ router: { back: jest.fn(), push: jest.fn(), navigate: jest.fn() } }));

const api = apiRequest as jest.MockedFunction<typeof apiRequest>;

const listItem = (d: MandirHome['deities'][number]): DeityListItem => ({
  id: d.id,
  slug: d.slug,
  nameHi: d.nameHi,
  nameEn: d.nameEn,
  weekday: null,
  image: d.image,
  inMandir: true,
});

/** The dev-user's mandir: Hanuman, Shiv, Ganesh (+ `extra` deities not in the mandir). */
function setup({ home = homePayload(), extra = [] as DeityListItem[], put }: {
  home?: MandirHome;
  extra?: DeityListItem[];
  put?: (body: SetMandirDeitiesRequest) => Promise<unknown>;
} = {}) {
  const saved: SetMandirDeitiesRequest[] = [];
  let current = home; // the server's state
  api.mockImplementation(((path: string, opts: { method?: string; body?: unknown }) => {
    if (path === '/mandir/home') return Promise.resolve(current);
    if (path === '/deities') return Promise.resolve([...home.deities.map(listItem), ...extra]);
    if (path === '/mandir/deities' && opts.method === 'PUT') {
      const body = opts.body as SetMandirDeitiesRequest;
      saved.push(body);
      const result = put ? put(body) : Promise.resolve({ items: body.items });
      return result.then((r) => {
        current = applyDeityListToHome(current, body);
        return r;
      });
    }
    return Promise.reject(new Error(`unmocked ${path}`));
  }) as never);
  return saved;
}

async function renderSangrah() {
  const client = createTestQueryClient();
  await render(<SangrahScreen />, { wrapper: withQueryClient(client) });
  await screen.findByText('मेरा मंदिर');
  return client;
}

const lastToast = () => useToastStore.getState().toast?.message;
const ids = (body: SetMandirDeitiesRequest | undefined) => body?.items.map((i) => i.deityId);

const PARVATI: DeityListItem = {
  id: uuid(50),
  slug: 'parvati',
  nameHi: 'पार्वती माता',
  nameEn: 'Parvati Mata',
  weekday: null,
  image: null,
  inMandir: false,
};

beforeEach(() => {
  api.mockReset();
  useToastStore.setState({ toast: null });
});

describe('VM-03 Sangrah', () => {
  it('lists my deities in order with the count', async () => {
    setup();
    await renderSangrah();
    expect(screen.getByText('3/12 देवता')).toBeTruthy();
    expect(screen.getByText('हनुमान जी')).toBeTruthy();
    expect(screen.getAllByLabelText('मुख्य देवता बनाएं')).toHaveLength(3);
  });

  it('removes a deity and saves the new list with positions', async () => {
    const saved = setup();
    const client = await renderSangrah();
    await fireEvent.press(screen.getAllByLabelText('मंदिर से हटाएं')[1]!); // Shiv

    await waitFor(() => expect(saved).toHaveLength(1));
    expect(saved[0]).toEqual({
      items: [
        { deityId: HANUMAN, position: 0, isPinned: false },
        { deityId: GANESH, position: 1, isPinned: false },
      ],
    });
    expect(screen.getByText('2/12 देवता')).toBeTruthy();
    expect(await screen.findByText('सहेजा गया')).toBeTruthy();
    // VM-01's cached home follows right away
    expect(client.getQueryData<MandirHome>(queryKeys.mandirHome)?.deities.map((d) => d.id)).toEqual([HANUMAN, GANESH]);
  });

  it('keeps at least one deity', async () => {
    const home = homePayload();
    home.deities = home.deities.slice(0, 1);
    const saved = setup({ home });
    await renderSangrah();
    await fireEvent.press(screen.getByLabelText('मंदिर से हटाएं'));
    expect(lastToast()).toBe('मंदिर में कम से कम एक देवता होने चाहिए');
    expect(saved).toHaveLength(0);
    expect(screen.getByText('हनुमान जी')).toBeTruthy();
  });

  it('pins one deity (the one shown first on app open)', async () => {
    const saved = setup();
    await renderSangrah();
    await fireEvent.press(screen.getAllByLabelText('मुख्य देवता बनाएं')[2]!); // Ganesh
    await waitFor(() => expect(saved).toHaveLength(1));
    expect(saved[0]!.items.map((i) => i.isPinned)).toEqual([false, false, true]);
    expect(screen.getAllByLabelText('मुख्य देवता हटाएं')).toHaveLength(1);
  });

  it('reorders with the screen reader move actions', async () => {
    const saved = setup();
    await renderSangrah();
    await fireEvent(screen.getByLabelText('गणेश जी'), 'accessibilityAction', { nativeEvent: { actionName: 'moveUp' } });
    await waitFor(() => expect(saved).toHaveLength(1));
    expect(ids(saved[0])).toEqual([HANUMAN, GANESH, SHIV]);
  });

  it('adds a deity from the grid and refuses a 13th', async () => {
    const saved = setup({ extra: [PARVATI] });
    await renderSangrah();
    await fireEvent.press(screen.getByText('सभी देवता'));
    const parvati = screen.getByLabelText('पार्वती माता, मेरे मंदिर में');
    expect(parvati).toHaveProp('accessibilityState', { checked: false });
    await fireEvent.press(parvati);
    await waitFor(() => expect(saved).toHaveLength(1));
    expect(ids(saved[0])).toEqual([HANUMAN, SHIV, GANESH, PARVATI.id]);
    expect(screen.getByLabelText('पार्वती माता, मेरे मंदिर में')).toHaveProp('accessibilityState', { checked: true });
  });

  it('allows at most 12 deities', async () => {
    const home = homePayload();
    const base = home.deities[0]!;
    home.deities = Array.from({ length: 12 }, (_, i) => ({ ...base, id: uuid(60 + i), nameHi: `देवता ${i}`, position: i }));
    const saved = setup({ home, extra: [PARVATI] });
    await renderSangrah();
    await fireEvent.press(screen.getByText('सभी देवता'));
    await fireEvent.press(screen.getByLabelText('पार्वती माता, मेरे मंदिर में'));
    expect(lastToast()).toBe('मंदिर में अधिकतम 12 देवता रख सकते हैं');
    expect(saved).toHaveLength(0);
  });

  it('shows a retry when saving fails and saves the current list again', async () => {
    let fail = true;
    const saved = setup({
      put: (body) => (fail ? Promise.reject(new ApiError(0, 'NETWORK_ERROR', 'offline')) : Promise.resolve({ items: body.items })),
    });
    await renderSangrah();
    await fireEvent.press(screen.getAllByLabelText('मंदिर से हटाएं')[0]!);
    const retry = await screen.findByText(/सहेजा नहीं जा सका/);
    fail = false;
    await fireEvent.press(retry);
    expect(await screen.findByText('सहेजा गया')).toBeTruthy();
    expect(saved).toHaveLength(2);
    expect(ids(saved[1])).toEqual([SHIV, GANESH]);
  });

  it('goes back with the header button', async () => {
    const { router } = jest.requireMock('expo-router');
    setup();
    await renderSangrah();
    await fireEvent.press(screen.getByLabelText('वापस'));
    expect(router.back).toHaveBeenCalled();
  });
});
