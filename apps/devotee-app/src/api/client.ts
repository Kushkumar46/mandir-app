import { apiErrorSchema, Header } from '@mandir/shared-types';
import { Platform } from 'react-native';
import type { z } from 'zod';

import { env } from '@/lib/env';

/** Codes produced by the client itself (the server's codes are `ErrorCode` in shared-types). */
export const ClientErrorCode = {
  NETWORK: 'NETWORK_ERROR',
  TIMEOUT: 'TIMEOUT',
  BAD_RESPONSE: 'BAD_RESPONSE',
} as const;

export class ApiError extends Error {
  constructor(
    /** HTTP status; 0 when the request never got a response. */
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details: Record<string, unknown> = {},
    /** Seconds from `Retry-After` (429). */
    readonly retryAfter?: number,
  ) {
    super(message);
    this.name = 'ApiError';
  }

  get isNetworkError(): boolean {
    return this.status === 0;
  }
}

export type RequestOptions<S extends z.ZodType> = {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  /** Validates `data` of the `{ data }` envelope. */
  schema: S;
  /** Required by the API for writes that spend coins/money (docs/01-architecture.md §3). */
  idempotencyKey?: string;
  signal?: AbortSignal;
  timeoutMs?: number;
};

export type ClientContext = {
  baseUrl: string;
  appVersion: string;
  platform: string;
  devUser?: string;
  fetch?: typeof fetch;
};

const defaultContext = (): ClientContext => ({
  baseUrl: env.apiUrl,
  appVersion: env.appVersion,
  platform: Platform.OS,
  devUser: env.devUser,
});

/** Calls `/v1<path>` and returns the unwrapped, validated `data`. Throws `ApiError`. */
export async function apiRequest<S extends z.ZodType>(
  path: string,
  { method = 'GET', body, schema, idempotencyKey, signal, timeoutMs = 15_000 }: RequestOptions<S>,
  ctx: ClientContext = defaultContext(),
): Promise<z.infer<S>> {
  const headers: Record<string, string> = {
    Accept: 'application/json',
    [Header.APP_VERSION]: ctx.appVersion,
    [Header.PLATFORM]: ctx.platform,
  };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (ctx.devUser) headers[Header.DEV_USER] = ctx.devUser;
  if (idempotencyKey) headers[Header.IDEMPOTENCY_KEY] = idempotencyKey;

  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);
  const onAbort = () => controller.abort();
  signal?.addEventListener('abort', onAbort);

  let res: Response;
  try {
    res = await (ctx.fetch ?? fetch)(`${ctx.baseUrl}/v1${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (e) {
    if (timedOut) throw new ApiError(0, ClientErrorCode.TIMEOUT, `Request timed out: ${method} ${path}`);
    if (signal?.aborted) throw e;
    throw new ApiError(0, ClientErrorCode.NETWORK, `Cannot reach ${ctx.baseUrl}: ${String(e)}`);
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', onAbort);
  }

  const json: unknown = await res.json().catch(() => undefined);
  if (!res.ok) {
    const parsed = apiErrorSchema.safeParse(json);
    const retryAfter = Number(res.headers.get('retry-after')) || undefined;
    if (parsed.success) {
      const { code, message, details } = parsed.data.error;
      throw new ApiError(res.status, code, message, details, retryAfter);
    }
    throw new ApiError(res.status, ClientErrorCode.BAD_RESPONSE, `HTTP ${res.status} for ${method} ${path}`);
  }

  const data = schema.safeParse((json as { data?: unknown } | undefined)?.data);
  if (!data.success) {
    throw new ApiError(res.status, ClientErrorCode.BAD_RESPONSE, `Unexpected response for ${method} ${path}: ${data.error.message}`);
  }
  return data.data;
}

/**
 * GETs a public CDN JSON file (e.g. an aarti lyrics timeline) — no `/v1`, no envelope, no app
 * headers — and validates it. Throws `ApiError` like `apiRequest`.
 */
export async function fetchPublicJson<S extends z.ZodType>(
  url: string,
  { schema, signal, timeoutMs = 15_000 }: { schema: S; signal?: AbortSignal; timeoutMs?: number },
  fetchImpl: typeof fetch = fetch,
): Promise<z.infer<S>> {
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);
  const onAbort = () => controller.abort();
  signal?.addEventListener('abort', onAbort);

  let res: Response;
  try {
    res = await fetchImpl(url, { headers: { Accept: 'application/json' }, signal: controller.signal });
  } catch (e) {
    if (timedOut) throw new ApiError(0, ClientErrorCode.TIMEOUT, `Request timed out: GET ${url}`);
    if (signal?.aborted) throw e;
    throw new ApiError(0, ClientErrorCode.NETWORK, `Cannot reach ${url}: ${String(e)}`);
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', onAbort);
  }
  if (!res.ok) throw new ApiError(res.status, ClientErrorCode.BAD_RESPONSE, `HTTP ${res.status} for GET ${url}`);
  const parsed = schema.safeParse(await res.json().catch(() => undefined));
  if (!parsed.success) throw new ApiError(res.status, ClientErrorCode.BAD_RESPONSE, `Unexpected file at ${url}: ${parsed.error.message}`);
  return parsed.data;
}
