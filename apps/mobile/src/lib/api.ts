import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { createApiClient } from '@whyme/api-client';
import { i18n } from './i18n';
import { getToken } from './token-store';

export { TOKEN_KEY } from './token-store';

/**
 * Laravel API base, without the version (paths are /v1/…). Set EXPO_PUBLIC_API_URL
 * in apps/mobile/.env. Without it: the web preview uses localhost, and Android
 * emulators reach the host machine's localhost at 10.0.2.2. A real phone needs
 * your PC's LAN IP.
 */
export const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_URL ?? (Platform.OS === 'web' ? 'http://localhost:8000/api' : 'http://10.0.2.2:8000/api');

/**
 * Photo links from the API use the API's own address (APP_URL, usually http://localhost:8000 on
 * the PC). A phone can't open the PC's "localhost", so in development builds the address is
 * swapped for the host in EXPO_PUBLIC_API_URL (the PC's Wi-Fi address). Release builds use the
 * links unchanged, because a real server's links are already public.
 */
const API_ORIGIN = API_BASE_URL.replace(/\/api\/?$/, '');

export function mediaUrl(url: string | null | undefined): string | undefined {
  if (!url) return undefined;
  if (!__DEV__) return url;
  return url.replace(/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?/, API_ORIGIN);
}

export async function appHeaders(): Promise<Record<string, string>> {
  const token = await getToken();
  return {
    'Accept-Language': i18n.language,
    'X-Platform': Platform.OS,
    'X-App-Version': Constants.expoConfig?.version ?? '0.0.0',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

export function createMobileApiClient() {
  return createApiClient({ baseUrl: API_BASE_URL, headers: appHeaders });
}
