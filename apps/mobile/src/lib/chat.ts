import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiRequestError, chatKeys, unwrap, useApi, type ApiClient, type Conversation, type MessagePage, type Order } from '@whyme/data';
import { useAccount } from './session';

/** The signed-in person's chats, newest first. */
export function useInbox(poll = false) {
  const api = useApi();
  const { status } = useAccount();
  return useQuery({
    queryKey: chatKeys.inbox,
    queryFn: async () => unwrap(await api.GET('/v1/me/conversations')).data as unknown as Conversation[],
    enabled: status === 'signed_in',
    refetchInterval: poll ? 15_000 : false,
    refetchIntervalInBackground: false,
  });
}

export function useConversation(id: string) {
  const api = useApi();
  return useQuery({
    queryKey: chatKeys.conversation(id),
    queryFn: async () => unwrap(await api.GET('/v1/conversations/{conversation}', { params: { path: { conversation: id } } })).data as unknown as Conversation,
  });
}

/** Messages newest page first; `before` loads older ones. Checked every 5 seconds while open. */
export function useMessages(id: string) {
  const api = useApi();
  return useInfiniteQuery({
    queryKey: chatKeys.messages(id),
    initialPageParam: null as string | null,
    queryFn: async ({ pageParam }) => {
      // `before` isn't in the generated query types.
      const query = (pageParam ? { before: pageParam } : {}) as never;
      return unwrap(await api.GET('/v1/conversations/{conversation}/messages', { params: { path: { conversation: id }, query } })) as unknown as MessagePage;
    },
    getNextPageParam: (last: MessagePage) => last.next_before,
    refetchInterval: 5_000,
  });
}

/**
 * The chat for an order. A chat the two already have is reused; otherwise the buyer (or either
 * side of a service request) starts one about the listing or request. A seller can't start a chat
 * about their own product, so `available` is false until the buyer writes first.
 */
export function useOrderChat(order: Order) {
  const api = useApi();
  const queryClient = useQueryClient();
  const inbox = useInbox();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const working = useRef(false);

  const existing = (inbox.data ?? []).find((c) =>
    order.service_request_id
      ? c.subject.type === 'service_request' && c.subject.id === order.service_request_id
      : c.subject.type === 'listing' && c.subject.id === order.listing_id && c.other_party.name === order.other_party.name,
  );
  const canStart = Boolean(order.service_request_id) || (order.role === 'buyer' && Boolean(order.listing_id));
  const available = Boolean(existing) || canStart;

  async function open() {
    if (working.current) return;
    if (existing) {
      router.push({ pathname: '/chat/[id]', params: { id: existing.id } });
      return;
    }
    working.current = true;
    setBusy(true);
    setError(null);
    try {
      const conversation = await startConversation(api, order.service_request_id ? { type: 'service_request', id: order.service_request_id } : { type: 'listing', id: order.listing_id! });
      queryClient.setQueryData(chatKeys.conversation(conversation.id), conversation);
      void queryClient.invalidateQueries({ queryKey: chatKeys.inbox });
      router.push({ pathname: '/chat/[id]', params: { id: conversation.id } });
    } catch (e) {
      setError(e instanceof ApiRequestError ? e.code : 'network_error');
    } finally {
      working.current = false;
      setBusy(false);
    }
  }

  return { available, open, busy, error };
}

export async function startConversation(api: ApiClient, subject: { type: 'listing' | 'profile' | 'service_request'; id: string }): Promise<Conversation> {
  return unwrap(await api.POST('/v1/conversations', { body: { subject_type: subject.type, subject_id: subject.id } })).data as unknown as Conversation;
}
