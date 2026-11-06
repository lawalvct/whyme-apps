import type { SyncController } from '@whyme/data';

/**
 * The signed-in account's sync controller, set after sign-in and cleared on
 * sign-out. App-level listeners (connectivity, foreground) drive it from here.
 */
let active: SyncController | null = null;

export function setActiveSync(controller: SyncController | null): void {
  active = controller;
}

export function activeSync(): SyncController | null {
  return active;
}
