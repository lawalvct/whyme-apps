'use client';

import { useLiveQuery } from 'dexie-react-hooks';
import type { OutboxAction } from '@whyme/sync';
import { CONVERSATION_ENTITY, type MessagePayload } from './chat-routes';
import { useAccountRuntime } from './offline';
import type { WebSync } from './sync';

/**
 * Chat messages typed without a connection (COM*, P2 "offline send with stable IDs").
 * Each waits in the send queue under its conversation, so they go in the order typed;
 * the message's client ID makes a resend return the same message (the API dedupes it).
 */

/** Keep showing a sent message as "Sending…" this long, until the refreshed list includes it. */
const SHOW_ACKED_MS = 10 * 60_000;

/**
 * This conversation's queued messages, oldest first: unsent ones, plus those sent in the last
 * few minutes (so the bubble doesn't blink out before the message list catches up).
 */
export function useQueuedMessages(conversationId: string): OutboxAction[] | undefined {
  const sync = useAccountRuntime();
  return useLiveQuery(async () => {
    if (!sync) return [];
    const all = await sync.db.outbox.where('[entityType+localId]').equals([CONVERSATION_ENTITY, conversationId]).toArray();
    const since = Date.now() - SHOW_ACKED_MS;
    return all
      .filter((a) => a.accountId === sync.accountId && (a.state !== 'acked' || (a.ackedAt ?? 0) > since))
      .sort((a, b) => a.createdAt - b.createdAt || (a.actionId < b.actionId ? -1 : 1));
  }, [sync, conversationId]);
}

export async function queueMessage(sync: WebSync, payload: MessagePayload): Promise<void> {
  await sync.engine.enqueue({ entityType: CONVERSATION_ENTITY, localId: payload.conversation_id, actionType: 'message.send', payload });
  await sync.controller.refresh().catch(() => undefined);
  if (navigator.onLine) void sync.controller.run().catch(() => undefined);
}

/** "Delete" on a message that couldn't be sent (or "Edit", which puts the text back first). */
export async function discardMessage(sync: WebSync, actionId: string): Promise<void> {
  await sync.engine.discard(actionId);
  await sync.controller.refresh().catch(() => undefined);
}
