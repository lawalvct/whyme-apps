import type { Metadata } from 'next';
import { Suspense } from 'react';
import { ListingEditor } from '@/components/seller/ListingEditor';
import { SignedInOnly } from '@/components/seller/SellerShell';
import { Skeleton } from '@/components/ui/skeleton';

export const metadata: Metadata = { title: 'New listing' };

type Props = PageProps<'/sell/listings/new'>;

export default function NewListingPage({ searchParams }: Props) {
  return (
    <Suspense fallback={<Skeleton className="h-96 w-full" />}>
      <NewListing searchParams={searchParams} />
    </Suspense>
  );
}

async function NewListing({ searchParams }: Pick<Props, 'searchParams'>) {
  const params = await searchParams;
  const kind = params.kind === 'product' || params.kind === 'service' ? params.kind : 'default';
  // A new type gets its own form on navigation. Native URL replacement after saving
  // still keeps the current editor mounted, including its saved message and draft.
  return <SignedInOnly><ListingEditor key={kind} /></SignedInOnly>;
}
