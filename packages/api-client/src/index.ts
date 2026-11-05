import createClient, { type Middleware } from 'openapi-fetch';
import type { paths } from './schema';

export type { paths };

export interface ApiClientOptions {
  /** e.g. "https://api.example.com/api/v1" */
  baseUrl: string;
  /** Called on every request: Authorization, Accept-Language, X-App-Version, X-Platform. */
  headers?: () => Record<string, string> | Promise<Record<string, string>>;
  /** "include" on the website (Sanctum cookie session); omit on mobile. */
  credentials?: RequestCredentials;
  fetch?: typeof fetch;
}

/** Typed client for online calls. Offline-capable writes go through @whyme/sync instead. */
export function createApiClient(options: ApiClientOptions) {
  const client = createClient<paths>({
    baseUrl: options.baseUrl,
    credentials: options.credentials,
    fetch: options.fetch,
    headers: { Accept: 'application/json' },
  });

  const appHeaders: Middleware = {
    async onRequest({ request }) {
      for (const [name, value] of Object.entries((await options.headers?.()) ?? {})) {
        request.headers.set(name, value);
      }
      return request;
    },
  };
  client.use(appHeaders);
  return client;
}

/** Error body every API error uses (docs/01 §5.6). */
export interface ApiError {
  code: string;
  message: string;
  fields?: Record<string, string[]>;
  retryable: boolean;
}
