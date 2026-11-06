import { createStore, useStore } from 'zustand';
import type { Me } from '../queries';

/**
 * Who is signed in on this device. The token itself never lives here: it stays
 * in secure storage (mobile) or an httpOnly cookie (web) (ACC03).
 */
export interface SessionState {
  status: 'unknown' | 'signed_out' | 'signed_in';
  user: Me | null;
}

export const sessionStore = createStore<SessionState>(() => ({ status: 'unknown', user: null }));

export function useSession<T>(selector: (state: SessionState) => T): T {
  return useStore(sessionStore, selector);
}

export function signedIn(user: Me): void {
  sessionStore.setState({ status: 'signed_in', user });
}

export function signedOut(): void {
  sessionStore.setState({ status: 'signed_out', user: null });
}
