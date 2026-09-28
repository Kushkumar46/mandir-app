import { z } from 'zod';

import { ApiError, apiRequest, ClientErrorCode, type ClientContext, fetchPublicJson } from './client';

const schema = z.object({ ok: z.boolean() });

function ctxWith(fetchImpl: jest.Mock, extra: Partial<ClientContext> = {}): ClientContext {
  return {
    baseUrl: 'http://192.168.1.20:4000',
    appVersion: '1.2.3',
    platform: 'android',
    fetch: fetchImpl as unknown as typeof fetch,
    ...extra,
  };
}

/** Minimal fetch Response stand-in (only what the client reads). */
function response(status: number, body: unknown, headers: Record<string, string> = {}) {
  const lower = Object.fromEntries(Object.entries(headers).map(([k, v]) => [k.toLowerCase(), v]));
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: (name: string) => lower[name.toLowerCase()] ?? null },
    json: () => (typeof body === 'string' ? Promise.reject(new SyntaxError('not json')) : Promise.resolve(body)),
  };
}

describe('apiRequest', () => {
  it('calls /v1<path> with app headers and unwraps { data }', async () => {
    const fetchMock = jest.fn().mockResolvedValue(response(200, { data: { ok: true } }));
    const data = await apiRequest('/config', { schema }, ctxWith(fetchMock, { devUser: 'dev-user' }));

    expect(data).toEqual({ ok: true });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('http://192.168.1.20:4000/v1/config');
    expect(init.method).toBe('GET');
    expect(init.headers).toMatchObject({ 'x-app-version': '1.2.3', 'x-platform': 'android', 'x-dev-user': 'dev-user' });
    expect(init.headers).not.toHaveProperty('Content-Type');
  });

  it('sends a JSON body and the Idempotency-Key', async () => {
    const fetchMock = jest.fn().mockResolvedValue(response(200, { data: { ok: true } }));
    await apiRequest(
      '/mandir/offerings',
      { method: 'POST', body: { a: 1 }, schema, idempotencyKey: 'key-1' },
      ctxWith(fetchMock),
    );
    const init = fetchMock.mock.calls[0][1];
    expect(init.body).toBe('{"a":1}');
    expect(init.headers).toMatchObject({ 'Content-Type': 'application/json', 'idempotency-key': 'key-1' });
    expect(init.headers).not.toHaveProperty('x-dev-user');
  });

  it('maps the API error envelope to ApiError', async () => {
    const fetchMock = jest.fn().mockResolvedValue(
      response(
        402,
        { error: { code: 'COINS_INSUFFICIENT', message: 'Not enough coins', details: { required: 5, balance: 2 } } },
        { 'Retry-After': '7' },
      ),
    );
    const err = await apiRequest('/x', { schema }, ctxWith(fetchMock)).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err).toMatchObject({
      status: 402,
      code: 'COINS_INSUFFICIENT',
      details: { required: 5, balance: 2 },
      retryAfter: 7,
    });
  });

  it('reports a non-JSON error as BAD_RESPONSE', async () => {
    const fetchMock = jest.fn().mockResolvedValue(response(502, '<html>502</html>'));
    await expect(apiRequest('/x', { schema }, ctxWith(fetchMock))).rejects.toMatchObject({
      status: 502,
      code: ClientErrorCode.BAD_RESPONSE,
    });
  });

  it('rejects a success payload that does not match the schema', async () => {
    const fetchMock = jest.fn().mockResolvedValue(response(200, { data: { ok: 'yes' } }));
    await expect(apiRequest('/x', { schema }, ctxWith(fetchMock))).rejects.toMatchObject({
      code: ClientErrorCode.BAD_RESPONSE,
    });
  });

  it('turns a failed connection into a network error (status 0)', async () => {
    const fetchMock = jest.fn().mockRejectedValue(new TypeError('Network request failed'));
    const err = (await apiRequest('/x', { schema }, ctxWith(fetchMock)).catch((e: unknown) => e)) as ApiError;
    expect(err.code).toBe(ClientErrorCode.NETWORK);
    expect(err.isNetworkError).toBe(true);
  });

  it('times out', async () => {
    const fetchMock = jest.fn(
      (_url: string, init: RequestInit) =>
        new Promise((_resolve, reject) => init.signal?.addEventListener('abort', () => reject(new Error('aborted')))),
    );
    await expect(apiRequest('/x', { schema, timeoutMs: 10 }, ctxWith(fetchMock))).rejects.toMatchObject({
      code: ClientErrorCode.TIMEOUT,
      status: 0,
    });
  });
});

describe('fetchPublicJson (CDN files, e.g. lyrics)', () => {
  const lyrics = z.array(z.object({ t: z.number(), line: z.string() }));
  const url = 'http://192.168.1.20:9000/media-public/lyrics/aarti/hanuman/v1.json';

  it('GETs the URL as is (no /v1, no envelope, no app headers) and validates it', async () => {
    const fetchMock = jest.fn().mockResolvedValue(response(200, [{ t: 0, line: 'जय' }]));
    await expect(fetchPublicJson(url, { schema: lyrics }, fetchMock as unknown as typeof fetch)).resolves.toEqual([{ t: 0, line: 'जय' }]);
    const [calledUrl, init] = fetchMock.mock.calls[0];
    expect(calledUrl).toBe(url);
    expect(init.headers).toEqual({ Accept: 'application/json' });
  });

  it('maps HTTP errors, bad files and network failures to ApiError', async () => {
    const f = (r: unknown) => jest.fn().mockResolvedValue(r) as unknown as typeof fetch;
    await expect(fetchPublicJson(url, { schema: lyrics }, f(response(404, {})))).rejects.toMatchObject({ status: 404, code: ClientErrorCode.BAD_RESPONSE });
    await expect(fetchPublicJson(url, { schema: lyrics }, f(response(200, { data: [] })))).rejects.toMatchObject({ code: ClientErrorCode.BAD_RESPONSE });
    const offline = jest.fn().mockRejectedValue(new TypeError('Network request failed')) as unknown as typeof fetch;
    await expect(fetchPublicJson(url, { schema: lyrics }, offline)).rejects.toMatchObject({ status: 0, code: ClientErrorCode.NETWORK });
  });
});
