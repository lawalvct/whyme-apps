import type { OutboxAction, RouteSpec } from '@whyme/sync';

/** The send queue's route for chat messages (no imports from the runtime, so lib/sync.ts can use it). */

export const CONVERSATION_ENTITY = 'conversation';

export interface MessagePayload {
  conversation_id: string;
  body: string;
  client_id: string;
}

export const chatRoutes: Record<string, (action: OutboxAction) => RouteSpec> = {
  'message.send': (action) => {
    const payload = action.payload as MessagePayload;
    return {
      method: 'POST',
      path: `/v1/conversations/${encodeURIComponent(payload.conversation_id)}/messages`,
      body: { body: payload.body, client_id: payload.client_id },
    };
  },
};
