'use client';

import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { chatKeys, unwrap, useApi, type Conversation } from '@whyme/data';
import { routes } from '@/lib/format';

/**
 * "Message seller": opens the conversation about a listing or page (or the one
 * already open) and goes to it.
 */
export function useStartConversation() {
  const api = useApi();
  const router = useRouter();
  const queryClient = useQueryClient();

  return async (subject: { type: 'listing' | 'profile' | 'service_request'; id: string }) => {
    const conversation = unwrap(
      await api.POST('/v1/conversations', { body: { subject_type: subject.type, subject_id: subject.id } }),
    ).data as unknown as Conversation;
    queryClient.setQueryData(chatKeys.conversation(conversation.id), conversation);
    router.push(routes.conversation(conversation.id));
  };
}
