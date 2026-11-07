import { createApiClient } from '@whyme/api-client';
import { i18n } from './i18n';

/** Laravel API base, without the version (paths are /v1/…). */
export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000/api';

/** The API's origin, where Sanctum's CSRF cookie endpoint lives. */
export const API_ORIGIN = new URL(API_BASE_URL).origin;

/**
 * Sanctum's cookie session needs the XSRF-TOKEN cookie echoed back as a header
 * on writes. Browsers' fetch doesn't do this by itself (axios does).
 */
function xsrfToken(): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(/(?:^|;\s*)XSRF-TOKEN=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

/** The website signs in with Sanctum's cookie session, so every call sends cookies. */
export function appHeaders(): Record<string, string> {
  const headers: Record<string, string> = { 'Accept-Language': i18n.language, 'X-Platform': 'web' };
  const token = xsrfToken();
  if (token) headers['X-XSRF-TOKEN'] = token;
  return headers;
}

export function createWebApiClient() {
  return createApiClient({ baseUrl: API_BASE_URL, credentials: 'include', headers: appHeaders });
}

/** Sets the XSRF-TOKEN cookie before sign-in or sign-up (Sanctum SPA flow). */
export async function prepareSession(): Promise<void> {
  await fetch(`${API_ORIGIN}/sanctum/csrf-cookie`, { credentials: 'include' });
}

const DEVICE_KEY = 'whyme.device';

/**
 * This browser as a device: a random ID kept in storage, so signing in again
 * here doesn't ask for an SMS code each time (docs/01 §11).
 */
export function webDevice(): { id: string; platform: 'web'; name: string } {
  let id: string | null = null;
  try {
    id = window.localStorage.getItem(DEVICE_KEY);
    if (!id) {
      id = crypto.randomUUID();
      window.localStorage.setItem(DEVICE_KEY, id);
    }
  } catch {
    id ??= crypto.randomUUID();
  }
  const browser = navigator.userAgent.match(/(Edg|OPR|Chrome|Firefox|Safari)\/[\d.]+/)?.[0]?.split('/')[0] ?? 'Browser';
  return { id, platform: 'web', name: `${browser} on the web` };
}
