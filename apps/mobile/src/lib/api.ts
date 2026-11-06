import Constants from 'expo-constants';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { createApiClient } from '@whyme/api-client';
import { i18n } from './i18n';

/**
 * Laravel API base, without the version (paths are /v1/…). Android emulators reach
 * the host machine's localhost at 10.0.2.2; a real phone needs your PC's LAN IP.
 */
export const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://10.0.2.2:8000/api';

/** The API token lives in the OS keychain/keystore, never in SQLite or Zustand (ACC03). */
export const TOKEN_KEY = 'whyme.api_token';

export async function appHeaders(): Promise<Record<string, string>> {
  const token = await SecureStore.getItemAsync(TOKEN_KEY);
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
