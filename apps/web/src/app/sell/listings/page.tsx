import type { Metadata } from 'next';
import { Suspense } from 'react';
import { ListingsManager } from '@/components/seller/ListingsManager';
import { SignedInOnly } from '@/components/seller/SellerShell';
import { Skeleton } from '@/components/ui/skeleton';

export const metadata: Metadata = { title: 'My listings' };

export default function MyListingsPage() {
  return (
    <Suspense fallback={<Skeleton className="h-96 w-full" />}>
      <SignedInOnly>
        <ListingsManager />
      </SignedInOnly>
    </Suspense>
  );
}
