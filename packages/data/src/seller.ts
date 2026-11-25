import { useQuery } from '@tanstack/react-query';
import type { components, paths } from '@whyme/api-client';
import { ApiRequestError, unwrap, useApi } from './api';
import { useOfflineFetcher } from './offline';

export type OwnerListing = components['schemas']['OwnerListingResource'];
export type OwnerProfile = components['schemas']['OwnerProfileResource'];
export type OwnerPhoto = OwnerListing['photos'][number];
export type Upload = components['schemas']['UploadResource'];
export type Terms = paths['/v1/terms/{type}']['get']['responses'][200]['content']['application/json']['data'];

export type ProfileKind = OwnerProfile['kind'];
export type ListingKind = OwnerListing['kind'];
export type ListingStatus = OwnerListing['status'];

/** The seller's side of the account. Keys start with "me" so signing out clears them. */
export const sellerKeys = {
  all: ['me', 'seller'] as const,
  profiles: ['me', 'seller', 'profiles'] as const,
  profile: (kind: ProfileKind) => ['me', 'seller', 'profiles', kind] as const,
  listings: (filters: { status?: ListingStatus | 'all'; kind?: ListingKind }) => ['me', 'seller', 'listings', filters] as const,
  listing: (id: string) => ['me', 'seller', 'listing', id] as const,
  terms: (type: 'seller' | 'platform' | 'buyer' | 'privacy', language: string) => ['terms', type, language] as const,
};

/** A business profile needs selling turned on; a provider profile needs services (ACC07). */
export const profileCapability = { business: 'vendor', provider: 'provider' } as const satisfies Record<ProfileKind, string>;
export const listingCapability = { product: 'vendor', service: 'provider' } as const satisfies Record<ListingKind, string>;

/** The owner's business and provider profiles (GET /me/profiles). */
export function useMyProfiles(enabled = true) {
  const api = useApi();
  const fetcher = useOfflineFetcher('my-profiles', 'all', async () => unwrap(await api.GET('/v1/me/profiles')).data);
  return useQuery({ queryKey: sellerKeys.profiles, queryFn: fetcher, enabled });
}

/** One profile, or null when the owner hasn't started it yet (404). */
export function useMyProfile(kind: ProfileKind, enabled = true) {
  const api = useApi();
  const fetcher = useOfflineFetcher('my-profile', kind, async (): Promise<OwnerProfile | null> => {
    try {
      return unwrap(await api.GET('/v1/me/profiles/{kind}', { params: { path: { kind } } })).data;
    } catch (e) {
      if (e instanceof ApiRequestError && e.status === 404) return null;
      throw e;
    }
  });
  return useQuery({
    queryKey: sellerKeys.profile(kind),
    queryFn: fetcher,
    enabled,
  });
}

/** One of the owner's listings, with its status and the version to send with edits. */
export function useMyListing(id: string | null) {
  const api = useApi();
  const fetcher = useOfflineFetcher('my-listing', id ?? '', async () => unwrap(await api.GET('/v1/me/listings/{listing}', { params: { path: { listing: id ?? '' } } })).data);
  return useQuery({ queryKey: sellerKeys.listing(id ?? ''), queryFn: fetcher, enabled: Boolean(id) });
}

/** The current terms in the reader's language, or English (GET /terms/{type}). */
export function useTerms(type: 'seller' | 'platform' | 'buyer' | 'privacy', language: string, enabled = true) {
  const api = useApi();
  return useQuery({
    queryKey: sellerKeys.terms(type, language),
    queryFn: async () => unwrap(await api.GET('/v1/terms/{type}', { params: { path: { type } } })).data,
    staleTime: 60 * 60_000,
    enabled,
  });
}
