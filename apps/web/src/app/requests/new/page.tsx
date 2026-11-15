import type { Metadata } from 'next';
import { Suspense } from 'react';
import { RequireAccount } from '@/components/auth/RequireAccount';
import { NewRequestView } from '@/components/requests/NewRequestView';
import { Skeleton } from '@/components/ui/skeleton';

export const metadata: Metadata = { title: 'Request a service' };

export default function NewRequestPage() {
  return (
    <Suspense fallback={<Skeleton className="h-96 w-full" />}>
      <RequireAccount phone="buy">
        <NewRequestView />
      </RequireAccount>
    </Suspense>
  );
}
