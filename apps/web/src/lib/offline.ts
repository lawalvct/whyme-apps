import { useSyncExternalStore } from 'react';
import Dexie from 'dexie';
import { syncStatusStore, type Me, type OfflineCache } from '@whyme/data';
import { createWebSync, requestPersistentStorage, type WebSync } from './sync';

/**
 * The website's offline runtime (docs/01 §6.6): the signed-in account's own IndexedDB
 * (`whyme_<userId>`) holds the send queue and the device's copy of what the person last
 * loaded. Opened as soon as we know who is signed in (online or from the last copy), closed
 * and deleted on sign-out so the next person on this computer sees nothing of it.
 */

const ME_KEY = 'whyme.me';

let current: WebSync | null = null;
let stopRunner: (() => void) | null = null;
const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of listeners) listener();
}

/** The last "who am I" answer, so the signed-in area opens offline. */
function readMe(): { data: Me; fetchedAt: number } | undefined {
  try {
    const raw = window.localStorage.getItem(ME_KEY);
    return raw ? (JSON.parse(raw) as { data: Me; fetchedAt: number }) : undefined;
  } catch {
    return undefined;
  }
}

function writeMe(me: Me): void {
  try {
    window.localStorage.setItem(ME_KEY, JSON.stringify({ data: me, fetchedAt: Date.now() }));
  } catch {
    // Private browsing or full storage: online use still works.
  }
}

function attach(accountId: string): WebSync {
  if (current?.accountId === accountId) return current;
  detach();
  current = createWebSync(accountId);
  stopRunner = startQueueRunner(current);
  emit();
  return current;
}

function detach(): void {
  stopRunner?.();
  stopRunner = null;
  current?.db.close();
  current = null;
  emit();
}

/** The open account runtime, opening it from the last signed-in account if needed. */
function runtime(): WebSync | null {
  if (current || typeof window === 'undefined') return current;
  const me = readMe();
  return me ? attach(me.data.id) : null;
}

export function accountRuntime(): WebSync | null {
  return runtime();
}

/** The signed-in account's runtime (send queue and local database), or null when signed out. */
export function useAccountRuntime(): WebSync | null {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => current,
    () => null,
  );
}

/**
 * The signed-in account, however it became known (a fetch, or sign-in setting it directly):
 * keep its "who am I" copy and open its database and send queue.
 */
export function rememberAccount(me: Me): void {
  writeMe(me);
  attach(me.id);
}

/** What `@whyme/data` uses to keep and read the device's copy (see withOfflineCopy). */
export const webOfflineCache: OfflineCache = {
  async get(kind, id) {
    if (kind === 'me') {
      const me = readMe();
      if (me) attach(me.data.id);
      return me;
    }
    const record = await runtime()?.db.records.get([kind, id]);
    return record ? { data: record.data, fetchedAt: record.fetchedAt } : undefined;
  },
  async put(kind, id, data) {
    if (kind === 'me') {
      if (data && typeof data === 'object' && 'id' in data) {
        writeMe(data as Me);
        attach((data as Me).id);
      }
      return;
    }
    await runtime()?.db.cache(kind, id, data);
  },
};

/**
 * Runs the send queue in one tab only (Web Locks; the other tabs wait their turn), on start,
 * every 30 seconds, when the connection comes back and when the tab is shown again.
 */
function startQueueRunner(sync: WebSync): () => void {
  let leader = false;
  let releaseLock: (() => void) | null = null;
  const abort = new AbortController();

  const tick = () => {
    if (leader && navigator.onLine) void sync.controller.run().catch(() => undefined);
    else void sync.controller.refresh().catch(() => undefined);
  };
  const onOnline = () => {
    syncStatusStore.setState({ online: true });
    tick();
  };
  const onVisible = () => {
    if (document.visibilityState === 'visible') tick();
  };

  window.addEventListener('online', onOnline);
  document.addEventListener('visibilitychange', onVisible);
  const timer = window.setInterval(tick, 30_000);

  const becomeLeader = async () => {
    leader = true;
    await sync.engine.recover().catch(() => 0);
    // Confirmed actions are kept a week (their replies feed follow-up saves), then dropped.
    await sync.engine.prune(7 * 24 * 3600_000).catch(() => 0);
    tick();
  };
  if ('locks' in navigator && navigator.locks) {
    navigator.locks
      .request(`whyme-outbox-${sync.accountId}`, { signal: abort.signal }, async () => {
        await becomeLeader();
        await new Promise<void>((resolve) => {
          releaseLock = resolve;
        });
      })
      .catch(() => undefined); // aborted while waiting for another tab
  } else {
    void becomeLeader();
  }
  void sync.controller.refresh().catch(() => undefined);
  void requestPersistentStorage().then((persisted) => storageStore.set(persisted));

  return () => {
    abort.abort();
    releaseLock?.();
    window.clearInterval(timer);
    window.removeEventListener('online', onOnline);
    document.removeEventListener('visibilitychange', onVisible);
  };
}

/** Whether the browser promised to keep this site's data (false in private browsing or low storage). */
const storageStore = (() => {
  let persisted: boolean | null = null;
  const subs = new Set<() => void>();
  return {
    get: () => persisted,
    set(value: boolean) {
      persisted = value;
      for (const sub of subs) sub();
    },
    subscribe(sub: () => void) {
      subs.add(sub);
      return () => subs.delete(sub);
    },
  };
})();

export function useStoragePersisted(): boolean | null {
  return useSyncExternalStore(storageStore.subscribe, storageStore.get, () => null);
}

/** Things not yet confirmed by the server for the signed-in account. */
export async function unsentCount(): Promise<number> {
  return (await runtime()?.engine.unsent())?.length ?? 0;
}

/**
 * After signing out: forget the account on this browser. Its database (queue and copies)
 * is deleted and the service worker drops the pages it kept.
 */
export async function forgetAccountOnThisDevice(): Promise<void> {
  const accountId = current?.accountId ?? readMe()?.data.id ?? null;
  try {
    window.localStorage.removeItem(ME_KEY);
  } catch {
    // ignore
  }
  detach();
  if (accountId) await Dexie.delete(`whyme_${accountId}`).catch(() => undefined);
  navigator.serviceWorker?.controller?.postMessage({ type: 'CLEAR_PAGES' });
}
