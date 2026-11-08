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
