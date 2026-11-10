import type { PublicListing, PublicProfile } from '@whyme/data';
import { routes } from '@/lib/format';

/** The site's own address, for absolute links in previews, product data and the sitemap. */
export const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000').replace(/\/+$/, '');

export function absoluteUrl(path: string): string {
  return `${siteUrl}${path}`;
}

/**
 * Structured data (schema.org) so search engines can show a listing's price, availability and
 * place. Products are `Product` with an `Offer`; services are `Service` in their area.
 */
export function listingJsonLd(listing: PublicListing): Record<string, unknown> {
  const url = absoluteUrl(routes.listing(listing));
  const images = listing.photos.map((photo) => photo.urls.large).filter(Boolean);
  const offer =
    listing.price_kobo === null
      ? undefined
      : {
          '@type': 'Offer',
          price: (listing.price_kobo / 100).toFixed(2),
          priceCurrency: listing.currency || 'NGN',
          availability: listing.in_stock ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
          url,
          areaServed: listing.location.name ?? undefined,
          seller: { '@type': 'Organization', name: listing.seller.name },
        };

  if (listing.kind === 'service') {
    return {
      '@context': 'https://schema.org',
      '@type': 'Service',
      name: listing.title,
      description: listing.description,
      image: images,
      url,
      areaServed: listing.location.name ?? undefined,
      provider: { '@type': 'LocalBusiness', name: listing.seller.name },
      offers: offer,
    };
  }

  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: listing.title,
    description: listing.description,
    image: images,
    url,
    category: listing.category.name ?? undefined,
    offers: offer,
  };
}

/** A business or provider page as a schema.org `LocalBusiness` in its area. */
export function profileJsonLd(profile: PublicProfile): Record<string, unknown> {
  const image = profile.logo?.large ?? profile.photos[0]?.urls.large;
  return {
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    name: profile.display_name,
    description: profile.about ?? undefined,
    image: image ?? undefined,
    url: absoluteUrl(routes.profile(profile)),
    address: profile.location.name ? { '@type': 'PostalAddress', addressLocality: profile.location.name, addressRegion: 'Delta', addressCountry: 'NG' } : undefined,
  };
}

/** For `<script type="application/ld+json">`: escapes `<` so text from sellers can't close the tag. */
export function jsonLdHtml(data: Record<string, unknown>): string {
  return JSON.stringify(data).replace(/</g, '\\u003c');
}
