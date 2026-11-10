import { createHttpTransport, SyncEngine } from '@whyme/sync';
import { DexieOutboxStore } from '@whyme/sync/dexie';
import { createSyncController } from '@whyme/data';
import { API_BASE_URL, appHeaders } from './api';
import { LocalDb } from './local-db';

/**
 * The signed-in account's offline queue on the website: same engine and rules as
 * mobile, stored in the account's IndexedDB next to its caches (docs/01 §6.6).
 */
export function createWebSync(accountId: string) {
  const db = new LocalDb(accountId);
  const engine = new SyncEngine({
    store: new DexieOutboxStore(db),
    accountId,
    transport: createHttpTransport({
      baseUrl: API_BASE_URL,
      healthPath: '/v1/health',
      credentials: 'include',
      headers: appHeaders,
      routes: {
        'profile.update': (action) => ({ method: 'PATCH', path: '/v1/me', body: action.payload }),
        'capability.activate': (action) => ({ method: 'POST', path: '/v1/me/capabilities', body: action.payload }),
        // Saved items: PUT and DELETE are idempotent, so a resend after a lost reply is harmless.
        'saved.add': (action) => ({ method: 'PUT', path: `/v1/me/saved/${(action.payload as { listing_id: string }).listing_id}` }),
        'saved.remove': (action) => ({ method: 'DELETE', path: `/v1/me/saved/${(action.payload as { listing_id: string }).listing_id}` }),
      },
    }),
  });
  const controller = createSyncController(engine);
  return { db, engine, controller, accountId };
}

export type WebSync = ReturnType<typeof createWebSync>;

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
