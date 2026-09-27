import { type ApiError, apiErrorSchema, Header } from '@mandir/shared-types';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
/** DEV_AUTH stub until the Auth module adds admin login. */
const DEV_USER = process.env.NEXT_PUBLIC_DEV_USER;

export class ApiRequestError extends Error {
  constructor(
    readonly status: number,
    readonly error: ApiError['error'],
  ) {
    super(error.message);
  }
}

/** Calls `/v1/<path>` and unwraps `{ data }`; throws ApiRequestError with the error envelope. */
export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set('Accept', 'application/json');
  if (init.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  if (DEV_USER) headers.set(Header.DEV_USER, DEV_USER);

  const res = await fetch(`${API_URL}/v1${path}`, { ...init, headers });
  const json: unknown = await res.json().catch(() => null);

  if (!res.ok) {
    const parsed = apiErrorSchema.safeParse(json);
    throw new ApiRequestError(
      res.status,
      parsed.success
        ? parsed.data.error
        : { code: 'INTERNAL', message: `HTTP ${res.status}`, details: {} },
    );
  }
  return (json as { data: T }).data;
}
