import { createContext, useContext, type ReactNode } from 'react';
import type { ApiError, createApiClient } from '@whyme/api-client';

export type ApiClient = ReturnType<typeof createApiClient>;

const ApiContext = createContext<ApiClient | null>(null);

/**
 * Each app builds its own client (cookie session on web, bearer token on mobile)
 * and provides it here; the shared hooks don't care which.
 */
export function ApiProvider({ client, children }: { client: ApiClient; children: ReactNode }) {
  return <ApiContext.Provider value={client}>{children}</ApiContext.Provider>;
}

export function useApi(): ApiClient {
  const client = useContext(ApiContext);
  if (!client) throw new Error('useApi() needs an <ApiProvider> above it.');
  return client;
}

/** Thrown by the shared hooks so callers get the API's error shape (docs/01 §5.6). */
export class ApiRequestError extends Error {
  constructor(
    readonly status: number,
    readonly body: ApiError | null,
  ) {
    super(body?.code ?? `http_${status}`);
    this.name = 'ApiRequestError';
  }

  get code(): string {
    return this.body?.code ?? `http_${this.status}`;
  }
}

/** Unwraps an openapi-fetch result: returns `data` or throws ApiRequestError. */
export function unwrap<T>(result: { data?: T; error?: unknown; response: Response }): T {
  if (result.data !== undefined && result.response.ok) return result.data;
  throw new ApiRequestError(result.response.status, isApiError(result.error) ? result.error : null);
}

function isApiError(value: unknown): value is ApiError {
  return typeof value === 'object' && value !== null && 'code' in value && typeof value.code === 'string';
}
