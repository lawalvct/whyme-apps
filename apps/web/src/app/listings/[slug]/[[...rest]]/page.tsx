import type { Metadata } from 'next';
import { notFound, permanentRedirect } from 'next/navigation';
import { ListingView } from '@/components/pages/ListingView';
import { formatNaira, routes } from '@/lib/format';
import { getListing, getProfileListings } from '@/lib/server-api';
import { absoluteUrl, jsonLdHtml, listingJsonLd } from '@/lib/seo';

type Props = PageProps<'/listings/[slug]/[[...rest]]'>;

/**
 * Waits for the listing before sending anything, so an old address (an ID link, a slug from
 * before a rename, or the old /listings/{id}/{title} form) gets a real 308 redirect to the
 * current one, and a missing listing a real 404. Search engines read both.
 */
export const instant = false;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const listing = await getListing(slug);
  if (!listing) return { title: 'Not found', robots: { index: false } };

  const price = listing.price_kobo === null ? '' : formatNaira(listing.price_kobo);
  const title = price ? `${listing.title} – ${price}` : listing.title;
  // What WhatsApp, Facebook and X show under the title when someone shares the link.
  const description = [price, listing.location.name, listing.description.replace(/\s+/g, ' ').slice(0, 140)].filter(Boolean).join(' · ');
  const image = listing.photos[0]?.urls.large;
  const url = routes.listing(listing);

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      type: 'website',
      url: absoluteUrl(url),
      title,
      description,
      images: image ? [{ url: image, alt: listing.title }] : undefined,
    },
    twitter: { card: image ? 'summary_large_image' : 'summary', title, description, images: image ? [image] : undefined },
  };
}

/** A product or service at /listings/{slug}. */
export default async function ListingPage({ params }: Props) {
  const { slug, rest } = await params;
  const listing = await getListing(slug);
  if (!listing) notFound();
  if ((rest?.length ?? 0) > 0 || listing.slug !== slug) permanentRedirect(routes.listing(listing));

  const sellerListings = listing.seller.profile_id ? await getProfileListings(listing.seller.profile_id).catch(() => []) : [];
  const related = sellerListings.filter((item) => item.id !== listing.id).slice(0, 4);

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdHtml(listingJsonLd(listing)) }} />
      <ListingView listing={listing} related={related} />
    </>
  );
}
