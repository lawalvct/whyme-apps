import { useQuery } from '@tanstack/react-query';
import type { components } from '@whyme/api-client';
import { unwrap, useApi } from './api';

/** What a conversation is about: a listing, or a business/provider page. */
export interface ConversationSubject {
  type: 'listing' | 'profile';
  id: string;
  kind: string | null;
  title: string;
  price_kobo: number | null;
  thumb: string | null;
  /** False once it's no longer public (sold, paused, hidden): the chat stays open. */
  available: boolean;
}

/** GET /v1/me/conversations item. The generated `subject` type is too loose, so it's set here. */
export type Conversation = Omit<components['schemas']['ConversationResource'], 'subject'> & { subject: ConversationSubject };

export type ChatMessage = components['schemas']['MessageResource'];

export interface MessagePage {
  data: ChatMessage[];
  /** Pass as `before` for older messages; null when there are none. */
  next_before: string | null;
}

export const chatKeys = {
  all: ['me', 'chat'] as const,
  inbox: ['me', 'chat', 'inbox'] as const,
  unread: ['me', 'chat', 'unread'] as const,
  conversation: (id: string) => ['me', 'chat', 'conversation', id] as const,
  messages: (id: string) => ['me', 'chat', 'messages', id] as const,
};

/**
 * Unread messages for the header badge. Checked every 30 seconds while the page
 * is open (live Pusher updates make this instant once configured).
 */
export function useUnreadMessages(enabled: boolean) {
  const api = useApi();
  return useQuery({
    queryKey: chatKeys.unread,
    queryFn: async () => Number(unwrap(await api.GET('/v1/me/conversations/unread')).data.count) || 0,
    enabled,
    refetchInterval: 30_000,
    refetchIntervalInBackground: false,
  });
}
