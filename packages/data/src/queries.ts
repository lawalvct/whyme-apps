import { useQuery } from '@tanstack/react-query';
import type { components, paths } from '@whyme/api-client';
import { unwrap, useApi } from './api';

type ConfigBody = paths['/v1/config']['get']['responses'][200]['content']['application/json']['data'];

/**
 * GET /v1/config. The generated type gets three fields wrong (Scramble can't
 * infer the object casts), so they are corrected here until the spec is fixed.
 */
export type AppConfig = Omit<ConfigBody, 'features' | 'settings' | 'min_supported_version'> & {
  features: Record<string, boolean>;
  settings: Record<string, unknown>;
  min_supported_version: { android: string; ios: string };
};

export type Me = components['schemas']['UserResource'];

/** Query keys in one place, so invalidation (e.g. from a Pusher event) can't drift. */
export const queryKeys = {
  config: ['config'] as const,
  me: ['me'] as const,
};

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

export function useMe(enabled: boolean) {
  const api = useApi();
  return useQuery({
    queryKey: queryKeys.me,
    queryFn: async () => unwrap(await api.GET('/v1/me')).data as Me,
    enabled,
  });
}
