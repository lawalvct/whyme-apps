import type { Metadata } from 'next';
import { Suspense } from 'react';
import { ListingEditor } from '@/components/seller/ListingEditor';
import { SignedInOnly } from '@/components/seller/SellerShell';
import { Skeleton } from '@/components/ui/skeleton';

export const metadata: Metadata = { title: 'Edit listing' };

type Props = PageProps<'/sell/listings/[id]'>;

export default function EditListingPage({ params }: Props) {
  return (
    <Suspense fallback={<Skeleton className="h-96 w-full" />}>
      <EditListing params={params} />
    </Suspense>
  );
}

async function EditListing({ params }: Pick<Props, 'params'>) {
  const { id } = await params;
  return (
    <SignedInOnly>
      <ListingEditor id={id} />
    </SignedInOnly>
  );
}
