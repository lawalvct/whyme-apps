import Constants from 'expo-constants';
import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { createHttpTransport, SyncEngine, uuidv7 } from '@whyme/sync';
import { i18n } from './i18n';
import { SqliteOutboxStore } from './outbox-store';

// Android emulators reach the host machine's localhost at 10.0.2.2.
export const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://10.0.2.2:8000/api/v1';

/** The API token lives in the OS keychain/keystore, never in SQLite (ACC03). */
export const TOKEN_KEY = 'whyme.api_token';

export function appHeaders(): Record<string, string> {
  return {
    'Accept-Language': i18n.language,
    'X-Platform': Platform.OS,
    'X-App-Version': Constants.expoConfig?.version ?? '0.0.0',
  };
}

/**
 * The signed-in account's offline queue (docs/01 §6). Call `engine.run()` on app
 * start, on return to the foreground, when connectivity returns, and on "Retry".
 */
export async function createMobileSync(accountId: string) {
  const store = await SqliteOutboxStore.open(accountId);
  const engine = new SyncEngine({
    store,
    accountId,
    newId: () => uuidv7(Date.now(), (length) => Crypto.getRandomBytes(length)),
    transport: createHttpTransport({
      baseUrl: API_URL,
      headers: async () => ({
        ...appHeaders(),
        Authorization: `Bearer ${(await SecureStore.getItemAsync(TOKEN_KEY)) ?? ''}`,
      }),
      routes: {
        'profile.update': (action) => ({ method: 'PATCH', path: '/me', body: action.payload }),
        'capability.activate': (action) => ({ method: 'POST', path: '/me/capabilities', body: action.payload }),
      },
    }),
  });

  // Anything left "sending" by a crash or force-stop goes back in the queue.
  await engine.recover();
  return { store, engine };
}
