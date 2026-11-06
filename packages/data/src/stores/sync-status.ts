import { createStore, useStore } from 'zustand';
import type { OutboxAction, RunResult, SyncEngine } from '@whyme/sync';

/** Feeds the global Online / Offline / Syncing / Sync failed indicator (OFF07). */
export interface SyncStatusState {
  online: boolean;
  syncing: boolean;
  lastRunAt: number | null;
  lastResult: RunResult['status'] | null;
  /** Everything not yet confirmed by the server. */
  unsent: number;
  /** Items the user must act on: rejected, conflicting or waiting for sign-in. */
  attention: number;
}

export type GlobalSyncStatus = 'offline' | 'syncing' | 'failed' | 'online';

export const syncStatusStore = createStore<SyncStatusState>(() => ({
  online: true,
  syncing: false,
  lastRunAt: null,
  lastResult: null,
  unsent: 0,
  attention: 0,
}));

export function useSyncStatus<T>(selector: (state: SyncStatusState) => T): T {
  return useStore(syncStatusStore, selector);
}

export function globalSyncStatus(state: SyncStatusState): GlobalSyncStatus {
  if (!state.online) return 'offline';
  if (state.syncing) return 'syncing';
  if (state.attention > 0 || state.lastResult === 'unreachable' || state.lastResult === 'offline') return 'failed';
  return 'online';
}

const ATTENTION_STATES: OutboxAction['state'][] = ['rejected', 'conflict', 'needs_auth'];

/**
 * Runs the outbox and keeps the status store current. The apps call `run()` on
 * start, on return to the foreground, when connectivity returns and on "Retry".
 */
export function createSyncController(engine: SyncEngine, store = syncStatusStore) {
  async function refresh(): Promise<void> {
    const unsent = await engine.unsent();
    store.setState({
      unsent: unsent.length,
      attention: unsent.filter((a) => ATTENTION_STATES.includes(a.state)).length,
    });
  }

  async function run(): Promise<RunResult> {
    store.setState({ syncing: true });
    try {
      const result = await engine.run();
      if (result.status !== 'busy') store.setState({ lastRunAt: Date.now(), lastResult: result.status });
      return result;
    } finally {
      store.setState({ syncing: false });
      await refresh();
    }
  }

  function setOnline(online: boolean): void {
    store.setState({ online });
    if (online) void run();
  }

  return { run, refresh, setOnline };
}

export type SyncController = ReturnType<typeof createSyncController>;
