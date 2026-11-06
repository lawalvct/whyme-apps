import { createApiClient } from '@whyme/api-client';
import { i18n } from './i18n';

/** Laravel API base, without the version (paths are /v1/…). */
export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000/api';

/** The website signs in with Sanctum's cookie session, so every call sends cookies. */
export function appHeaders(): Record<string, string> {
  return { 'Accept-Language': i18n.language, 'X-Platform': 'web' };
}

export function createWebApiClient() {
  return createApiClient({ baseUrl: API_BASE_URL, credentials: 'include', headers: appHeaders });
}
