import { Suspense } from 'react';
import { RequireAccount } from '@/components/auth/RequireAccount';
import { OrdersList } from '@/components/orders/OrdersList';
import { Skeleton } from '@/components/ui/skeleton';

export default function OrdersPage() {
  return (
    <Suspense fallback={<Skeleton className="h-96 w-full" />}>
      <RequireAccount phone="buy">
        <OrdersList />
      </RequireAccount>
    </Suspense>
  );
}
