import { Suspense } from 'react';
import { RequireAccount } from '@/components/auth/RequireAccount';
import { RequestsList } from '@/components/requests/RequestsList';
import { Skeleton } from '@/components/ui/skeleton';

export default function RequestsPage() {
  return (
    <Suspense fallback={<Skeleton className="h-96 w-full" />}>
      <RequireAccount phone="buy">
        <RequestsList />
      </RequireAccount>
    </Suspense>
  );
}
