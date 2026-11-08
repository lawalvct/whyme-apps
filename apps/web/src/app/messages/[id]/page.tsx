import type { Metadata } from 'next';
import { Suspense } from 'react';
import { RequireAccount } from '@/components/auth/RequireAccount';
import { ConversationView } from '@/components/chat/ConversationView';
import { Skeleton } from '@/components/ui/skeleton';

export const metadata: Metadata = { title: 'Conversation' };

type Props = PageProps<'/messages/[id]'>;

export default function ConversationPage({ params }: Props) {
  return (
    <Suspense fallback={<Skeleton className="h-96 w-full" />}>
      <Conversation params={params} />
    </Suspense>
  );
}

async function Conversation({ params }: Pick<Props, 'params'>) {
  const { id } = await params;
  return (
    <RequireAccount phone="buy">
      <ConversationView id={id} />
    </RequireAccount>
  );
}
