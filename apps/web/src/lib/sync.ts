import { createHttpTransport, SyncEngine } from '@whyme/sync';
import { DexieOutboxStore } from '@whyme/sync/dexie';
import { i18n } from './i18n';

export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000/api/v1';

/**
 * The website's offline queue: same engine and rules as mobile, stored in a
 * per-account IndexedDB database (docs/01 §6.6). Signed in with Sanctum's cookie session.
 */
export function createWebSync(accountId: string) {
  const store = new DexieOutboxStore(accountId);
  const engine = new SyncEngine({
    store,
    accountId,
    transport: createHttpTransport({
      baseUrl: API_URL,
      credentials: 'include',
      headers: () => ({ 'Accept-Language': i18n.language, 'X-Platform': 'web' }),
      routes: {
        'profile.update': (action) => ({ method: 'PATCH', path: '/me', body: action.payload }),
        'capability.activate': (action) => ({ method: 'POST', path: '/me/capabilities', body: action.payload }),
      },
    }),
  });
  return { store, engine };
}

/**
 * Asks the browser not to evict saved work. When refused (private mode, low
 * storage) the app must warn the user (sync.storageNotPersistent).
 */
export async function requestPersistentStorage(): Promise<boolean> {
  try {
    return (await navigator.storage?.persist?.()) ?? false;
  } catch {
    return false;
  }
}
