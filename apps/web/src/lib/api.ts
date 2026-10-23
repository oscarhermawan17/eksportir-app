const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly messages: string[],
  ) {
    super(messages[0] ?? `Request failed (${status})`);
  }
}

/**
 * Single client for the NestJS API. Auth is a httpOnly cookie, so every call sends credentials
 * and no token is ever kept in JavaScript.
 */
export async function apiFetch<T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      method: init.method ?? 'GET',
      credentials: 'include',
      headers: init.body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
    });
  } catch {
    throw new ApiError(0, ['Network error']);
  }

  if (!response.ok) {
    throw new ApiError(response.status, await readErrorMessages(response));
  }
  if (response.status === 204) {
    return undefined as T;
  }
  return (await response.json()) as T;
}

async function readErrorMessages(response: Response): Promise<string[]> {
  try {
    const body: unknown = await response.json();
    const message = (body as { message?: unknown }).message;
    if (Array.isArray(message)) {
      return message.map(String);
    }
    if (typeof message === 'string') {
      return [message];
    }
  } catch {
    // Response had no JSON body; fall through to the generic message.
  }
  return [`Request failed (${response.status})`];
}

export type AuthErrorKey =
  | 'invalidCredentials'
  | 'emailTaken'
  | 'tooManyAttempts'
  | 'invalidInput'
  | 'network'
  | 'generic';

/** Maps an API error to a key under `Auth.errors` in messages/*.json (the API itself answers in English). */
export function authErrorKey(error: unknown): AuthErrorKey {
  if (!(error instanceof ApiError)) {
    return 'generic';
  }
  switch (error.status) {
    case 0:
      return 'network';
    case 400:
      return 'invalidInput';
    case 401:
      return 'invalidCredentials';
    case 409:
      return 'emailTaken';
    case 429:
      return 'tooManyAttempts';
    default:
      return 'generic';
  }
}

export type ErrorKey =
  | 'network'
  | 'generic'
  | 'invalidInput'
  | 'unauthorized'
  | 'forbidden'
  | 'notFound'
  | 'conflict'
  | 'tooManyAttempts'
  | 'unavailable';

/** Maps any API error to a key under `Errors` in messages/*.json. */
export function errorKey(error: unknown): ErrorKey {
  if (!(error instanceof ApiError)) {
    return 'generic';
  }
  switch (error.status) {
    case 0:
      return 'network';
    case 400:
      return 'invalidInput';
    case 401:
      return 'unauthorized';
    case 403:
      return 'forbidden';
    case 404:
      return 'notFound';
    case 409:
      return 'conflict';
    case 429:
      return 'tooManyAttempts';
    case 503:
      return 'unavailable';
    default:
      return 'generic';
  }
}
