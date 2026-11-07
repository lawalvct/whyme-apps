import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { ListingView } from '@/components/pages/ListingView';
import { DetailSkeleton } from '@/components/pages/DetailSkeleton';
import { formatNaira, routes } from '@/lib/format';
import { getListing } from '@/lib/server-api';

type Props = PageProps<'/listings/[id]/[[...slug]]'>;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const listing = await getListing(id);
  if (!listing) return { title: 'Not found', robots: { index: false } };

  const price = listing.price_kobo === null ? '' : ` – ${formatNaira(listing.price_kobo)}`;
  const image = listing.photos[0]?.urls.large;
  return {
    title: `${listing.title}${price}`,
    description: `${listing.description.slice(0, 150)} · ${listing.location.name}`,
    alternates: { canonical: routes.listing(listing) },
    openGraph: { title: listing.title, images: image ? [{ url: image }] : undefined },
  };
}

/** A product or service. Cached for minutes; `params` is read inside Suspense so unknown IDs still get the instant shell. */
export default function ListingPage({ params }: Props) {
  return (
    <Suspense fallback={<DetailSkeleton />}>
      <ListingDetails params={params} />
    </Suspense>
  );
}

async function ListingDetails({ params }: Pick<Props, 'params'>) {
  const { id } = await params;
  const listing = await getListing(id);
  if (!listing) notFound();
  return <ListingView listing={listing} />;
}
