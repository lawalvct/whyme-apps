import { QueryClient } from '@tanstack/react-query';
import { ApiRequestError } from './api';

/** Errors worth retrying: no connection, timeouts, rate limits and server errors. */
export function isRetryable(error: unknown): boolean {
  if (!(error instanceof ApiRequestError)) return true;
  const { status } = error;
  return status === 408 || status === 425 || status === 429 || status >= 500;
}

/**
 * One QueryClient per app. Data that must work offline is kept in the local
 * database (docs/01 §15.1); reads fall back to it through `withOfflineCopy`.
 */
export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // Run the first attempt even when the device says it's offline, so a kept copy can
        // answer; only the retries wait for the connection ("online" would wait forever).
        networkMode: 'offlineFirst',
        staleTime: 30_000,
        gcTime: 5 * 60_000,
        retry: (failureCount, error) => failureCount < 3 && isRetryable(error),
        // Slow links: don't refetch every time the window or app regains focus.
        refetchOnWindowFocus: false,
      },
      mutations: {
        // Writes that must survive going offline use the outbox, never a mutation retry.
        retry: false,
        // Fail at once offline (the screen says so) instead of a button stuck on "Loading".
        networkMode: 'always',
      },
    },
  });
}
