import * as Crypto from 'expo-crypto';
import { createHttpTransport, SyncEngine, uuidv7 } from '@whyme/sync';
import { createSyncController } from '@whyme/data';
import { openAccountDatabase } from '@/db';
import { API_BASE_URL, appHeaders } from './api';
import { SqliteOutboxStore } from './outbox-store';

/**
 * Opens the signed-in account's database and its offline queue (docs/01 §6).
 * `controller.run()` is called on start, on return to the foreground, when
 * connectivity returns and on "Retry" (see AppProviders).
 */
export async function createMobileSync(accountId: string) {
  const account = await openAccountDatabase(accountId);
  const engine = new SyncEngine({
    store: new SqliteOutboxStore(account.sqlite),
    accountId,
    newId: () => uuidv7(Date.now(), (length) => Crypto.getRandomBytes(length)),
    transport: createHttpTransport({
      baseUrl: API_BASE_URL,
      healthPath: '/v1/health',
      headers: appHeaders,
      routes: {
        'profile.update': (action) => ({ method: 'PATCH', path: '/v1/me', body: action.payload }),
        'capability.activate': (action) => ({ method: 'POST', path: '/v1/me/capabilities', body: action.payload }),
      },
    }),
  });

  // Anything left "sending" by a crash or force-stop goes back in the queue.
  await engine.recover();
  const controller = createSyncController(engine);
  await controller.refresh();

  return { account, engine, controller };
}
