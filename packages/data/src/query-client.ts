import { QueryClient } from '@tanstack/react-query';
import { ApiRequestError } from './api';

/** Errors worth retrying: no connection, timeouts, rate limits and server errors. */
export function isRetryable(error: unknown): boolean {
  if (!(error instanceof ApiRequestError)) return true;
  const { status } = error;
  return status === 408 || status === 425 || status === 429 || status >= 500;
}

/**
 * One QueryClient per app. Online reads only: data that must work offline lives
 * in the local database instead (docs/01 §15.1).
 */
export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        gcTime: 5 * 60_000,
        retry: (failureCount, error) => failureCount < 3 && isRetryable(error),
        // Slow links: don't refetch every time the window or app regains focus.
        refetchOnWindowFocus: false,
      },
      mutations: {
        // Writes that must survive going offline use the outbox, never a mutation retry.
        retry: false,
      },
    },
  });
}
