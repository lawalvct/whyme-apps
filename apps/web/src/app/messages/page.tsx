import { Suspense } from 'react';
import { RequireAccount } from '@/components/auth/RequireAccount';
import { Inbox } from '@/components/chat/Inbox';
import { Skeleton } from '@/components/ui/skeleton';

export default function MessagesPage() {
  return (
    <Suspense fallback={<Skeleton className="h-96 w-full" />}>
      <RequireAccount phone="buy">
        <Inbox />
      </RequireAccount>
    </Suspense>
  );
}
