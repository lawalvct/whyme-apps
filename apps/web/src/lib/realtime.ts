'use client';

import Pusher from 'pusher-js';
import { useEffect, useRef, useSyncExternalStore } from 'react';
import { API_ORIGIN, appHeaders } from './api';

const KEY = process.env.NEXT_PUBLIC_PUSHER_KEY;
const CLUSTER = process.env.NEXT_PUBLIC_PUSHER_CLUSTER ?? 'eu';

/** Live updates need a Pusher key; without one the pages simply check every few seconds. */
export const realtimeConfigured = Boolean(KEY);

let client: Pusher | null = null;
let subscribers = 0;
let connected = false;
const listeners = new Set<() => void>();

function setConnected(value: boolean) {
  if (connected === value) return;
  connected = value;
  listeners.forEach((listener) => listener());
}

/**
 * Private channels are signed by the API (POST /api/broadcasting/auth) with the
 * same cookie session and XSRF header as every other call.
 */
function connect(): Pusher {
  if (client) return client;
  if (process.env.NODE_ENV === 'development') Pusher.logToConsole = true;

  client = new Pusher(KEY as string, {
    cluster: CLUSTER,
    forceTLS: true,
    channelAuthorization: {
      endpoint: `${API_ORIGIN}/api/broadcasting/auth`,
      transport: 'ajax',
      customHandler: ({ socketId, channelName }, callback) => {
        fetch(`${API_ORIGIN}/api/broadcasting/auth`, {
          method: 'POST',
          credentials: 'include',
          headers: { ...appHeaders(), Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({ socket_id: socketId, channel_name: channelName }),
        })
          .then(async (response) => {
            if (!response.ok) throw new Error(`Channel sign-in failed (${response.status})`);
            callback(null, await response.json());
          })
          .catch((error: Error) => callback(error, null));
      },
    },
  });
  client.connection.bind('state_change', ({ current }: { current: string }) => setConnected(current === 'connected'));
  return client;
}

function disconnect() {
  client?.disconnect();
  client = null;
  setConnected(false);
}

/** True while the live connection is up: pages then check for changes far less often. */
export function useRealtimeConnected(): boolean {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => connected,
    () => false,
  );
}

/**
 * Live events for the signed-in user (private channel `users.{id}`), e.g.
 * `message.delivered`. Connects only while a page using it is open, and
 * disconnects when the last one closes (docs/01 §7: stay within Pusher's limits).
 */
export function useUserEvents(userId: string | undefined, handlers: Record<string, (data: unknown) => void>) {
  const latest = useRef(handlers);
  useEffect(() => {
    latest.current = handlers;
  });

  const events = Object.keys(handlers).sort().join(',');

  useEffect(() => {
    if (!realtimeConfigured || !userId) return;
    const pusher = connect();
    subscribers++;
    const name = `private-users.${userId}`;
    const channel = pusher.subscribe(name);
    const bound = events.split(',').map((event) => {
      const handler = (data: unknown) => latest.current[event]?.(data);
      channel.bind(event, handler);
      return [event, handler] as const;
    });

    return () => {
      bound.forEach(([event, handler]) => channel.unbind(event, handler));
      subscribers--;
      if (subscribers === 0) {
        pusher.unsubscribe(name);
        disconnect();
      }
    };
  }, [userId, events]);
}
