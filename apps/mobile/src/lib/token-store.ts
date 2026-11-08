import * as SecureStore from 'expo-secure-store';

/** The API token lives in the OS keychain/keystore, never in SQLite or Zustand (ACC03). */
export const TOKEN_KEY = 'whyme.api_token';

export function getToken(): Promise<string | null> {
  return SecureStore.getItemAsync(TOKEN_KEY);
}

export function setToken(token: string): Promise<void> {
  return SecureStore.setItemAsync(TOKEN_KEY, token);
}

export function clearToken(): Promise<void> {
  return SecureStore.deleteItemAsync(TOKEN_KEY);
}
