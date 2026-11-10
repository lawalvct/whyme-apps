import { useQuery } from '@tanstack/react-query';
import type { components, paths } from '@whyme/api-client';
import { unwrap, useApi } from './api';
import { useOfflineFetcher } from './offline';

type ConfigBody = paths['/v1/config']['get']['responses'][200]['content']['application/json']['data'];

/**
 * GET /v1/config. Scramble types string-keyed maps as lists, so `features` and
 * `settings` (objects keyed by flag/setting name) are corrected here.
 */
export type AppConfig = Omit<ConfigBody, 'features' | 'settings'> & {
  features: Record<string, boolean>;
  settings: Record<string, unknown>;
};

export type Me = components['schemas']['UserResource'];
export type PublicListing = components['schemas']['PublicListingResource'];
export type PublicProfile = components['schemas']['PublicProfileResource'];
export type Taxonomy = paths['/v1/taxonomy']['get']['responses'][200]['content']['application/json']['data'];
export type TaxonomyCategory = Taxonomy['categories'][number];
export type TaxonomyLocation = Taxonomy['locations'][number];

/** Query keys in one place, so invalidation (e.g. from a Pusher event) can't drift. */
export const queryKeys = {
  config: ['config'] as const,
  me: ['me'] as const,
  taxonomy: ['taxonomy'] as const,
};

/**
 * Categories and areas in every language (GET /v1/taxonomy). Changes rarely, so
 * it's kept for a day; the apps also store a copy for offline use (docs/03 §2).
 */
export function useTaxonomy() {
  const api = useApi();
  return useQuery({
    queryKey: queryKeys.taxonomy,
    queryFn: async (): Promise<Taxonomy> => unwrap(await api.GET('/v1/taxonomy')).data,
    staleTime: 24 * 60 * 60_000,
    gcTime: 24 * 60 * 60_000,
  });
}

/** A category's name in the given language, falling back to English (I18N04). */
export function categoryLabel(category: Pick<TaxonomyCategory, 'name'> | undefined, language: string): string | undefined {
  if (!category) return undefined;
  const names = category.name as Record<string, string | null | undefined>;
  return names[language] || names.en || undefined;
}

/**
 * GET /v1/config. Apps can pass a copy saved on the device as `initialData` so the
 * first screen works offline; `initialDataUpdatedAt: 0` still refreshes it when online.
 */
export function useConfig(options: { initialData?: AppConfig; initialDataUpdatedAt?: number } = {}) {
  const api = useApi();
  return useQuery({
    queryKey: queryKeys.config,
    queryFn: async () => unwrap(await api.GET('/v1/config')).data as unknown as AppConfig,
    staleTime: 10 * 60_000,
    initialData: options.initialData,
    initialDataUpdatedAt: options.initialDataUpdatedAt,
  });
}

/**
 * Who is signed in. Offline it falls back to the device's copy of the last answer, so the
 * signed-in area still opens without a connection; a 401 from the server still means signed out.
 */
export function useMe(enabled: boolean) {
  const api = useApi();
  const fetcher = useOfflineFetcher('me', 'current', async () => unwrap(await api.GET('/v1/me')).data as Me);
  return useQuery({ queryKey: queryKeys.me, queryFn: fetcher, enabled });
}
