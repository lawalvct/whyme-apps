import type { Metadata } from 'next';
import { Suspense } from 'react';
import { RequireAccount } from '@/components/auth/RequireAccount';
import { PayoutsPage } from '@/components/seller/PayoutsPage';
import { Skeleton } from '@/components/ui/skeleton';

export const metadata: Metadata = { title: 'Payouts' };

export default function SellerPayoutsPage() {
  return (
    <Suspense fallback={<Skeleton className="h-96 w-full" />}>
      <RequireAccount phone="seller">
        <PayoutsPage />
      </RequireAccount>
    </Suspense>
  );
}
