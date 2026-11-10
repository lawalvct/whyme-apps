import { createContext, useContext, type ReactNode } from 'react';
import { createStore, useStore } from 'zustand';
import { ApiRequestError } from './api';

/**
 * The device's own copy of what the person last loaded, for reading offline (OFF02, AT05).
 * The website keeps it in the account's IndexedDB; the app in its SQLite file. Only private,
 * per-account data goes here: public pages are kept by the website's service worker.
 */
export interface OfflineCache {
  get(kind: string, id: string): Promise<{ data: unknown; fetchedAt: number } | undefined>;
  put(kind: string, id: string, data: unknown): Promise<void>;
}

const OfflineCacheContext = createContext<OfflineCache | null>(null);

export function OfflineCacheProvider({ cache, children }: { cache: OfflineCache | null; children: ReactNode }) {
  return <OfflineCacheContext.Provider value={cache}>{children}</OfflineCacheContext.Provider>;
}

export function useOfflineCache(): OfflineCache | null {
  return useContext(OfflineCacheContext);
}

/** Which screens are showing the device's copy right now, and from when (for "Offline copy – last updated …"). */
export const offlineCopyStore = createStore<{ copies: Record<string, number> }>(() => ({ copies: {} }));

function markCopy(key: string, fetchedAt: number | null): void {
  offlineCopyStore.setState((state) => {
    const copies = { ...state.copies };
    if (fetchedAt === null) delete copies[key];
    else copies[key] = fetchedAt;
    return { copies };
  });
}

/** When this record is the device's copy (offline), the time it was last fetched; otherwise null. */
export function useOfflineCopy(kind: string, id: string): number | null {
  return useStore(offlineCopyStore, (state) => state.copies[`${kind}:${id}`] ?? null);
}

/** A lost connection, not an answer from the server (which arrives as ApiRequestError). */
export function isConnectionError(error: unknown): boolean {
  return !(error instanceof ApiRequestError);
}

/**
 * Wraps a query's fetcher: every successful load is kept on the device, and when the
 * connection fails the kept copy is returned instead (marked, so the screen can say so).
 * A real answer from the server (401, 404, 409…) is never hidden behind an old copy.
 */
export function withOfflineCopy<T>(cache: OfflineCache | null, kind: string, id: string, fetcher: () => Promise<T>): () => Promise<T> {
  return async () => {
    const key = `${kind}:${id}`;
    try {
      const data = await fetcher();
      markCopy(key, null);
      // Keeping the copy must never break the screen (a full quota, private browsing…).
      if (cache) await cache.put(kind, id, data).catch(() => undefined);
      return data;
    } catch (error) {
      if (!cache || !isConnectionError(error)) throw error;
      const kept = await cache.get(kind, id).catch(() => undefined);
      if (!kept) throw error;
      markCopy(key, kept.fetchedAt);
      return kept.data as T;
    }
  };
}

/** `withOfflineCopy` with the cache from context. */
export function useOfflineFetcher<T>(kind: string, id: string, fetcher: () => Promise<T>): () => Promise<T> {
  return withOfflineCopy(useOfflineCache(), kind, id, fetcher);
}
