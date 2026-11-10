import { useQuery } from '@tanstack/react-query';
import { unwrap, useApi } from './api';
import { useOfflineFetcher } from './offline';
import type { PublicListing } from './queries';

export const savedKeys = {
  all: ['me', 'saved'] as const,
};

/**
 * The person's saved listings (GET /v1/me/saved), newest first. Readable offline from the
 * device's copy; each online load replaces that copy, so a listing that was taken down
 * disappears instead of coming back (AT05).
 */
export function useSavedListings(enabled = true) {
  const api = useApi();
  const fetcher = useOfflineFetcher('saved', 'listings', async () => unwrap(await api.GET('/v1/me/saved')).data as PublicListing[]);
  return useQuery({ queryKey: savedKeys.all, queryFn: fetcher, enabled });
}
