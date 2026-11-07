import type { Metadata } from 'next';
import { Suspense } from 'react';
import { ListingEditor } from '@/components/seller/ListingEditor';
import { SignedInOnly } from '@/components/seller/SellerShell';
import { Skeleton } from '@/components/ui/skeleton';

export const metadata: Metadata = { title: 'New listing' };

export default function NewListingPage() {
  return (
    <Suspense fallback={<Skeleton className="h-96 w-full" />}>
      <SignedInOnly>
        <ListingEditor />
      </SignedInOnly>
    </Suspense>
  );
}
