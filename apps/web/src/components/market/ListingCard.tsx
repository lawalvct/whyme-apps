'use client';

import Link from 'next/link';
import type { PublicListing } from '@whyme/data';
import { routes } from '@/lib/format';
import { useT } from '@/lib/i18n';
import { Photo } from './Photo';
import { Price } from './Price';
import { VerifiedBadge } from './VerifiedBadge';

export function ListingCard({ listing }: { listing: PublicListing }) {
  const { t } = useT('market');
  const photo = listing.photos[0];

  return (
    <Link
      href={routes.listing(listing)}
      className="group flex flex-col overflow-hidden rounded-xl border border-border bg-background transition-shadow hover:shadow-md focus-visible:outline-2 focus-visible:outline-primary"
    >
      <Photo src={photo?.urls.medium} alt={listing.title} className="aspect-[4/3] w-full" />
      <div className="flex flex-1 flex-col gap-1 p-3">
        <h3 className="line-clamp-2 font-semibold text-text group-hover:text-primary">{listing.title}</h3>
        <Price kobo={listing.price_kobo} kind={listing.kind} className="text-lg font-bold text-primary" />
        <p className="mt-auto flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-text-muted">
          <span>{listing.location.name}</span>
          {listing.kind === 'product' && !listing.in_stock ? <span className="text-danger">{t('outOfStock')}</span> : null}
        </p>
        <p className="flex items-center gap-2 truncate text-sm text-text-muted">
          <span className="truncate">{listing.seller.name}</span>
          {listing.seller.verified ? <VerifiedBadge /> : null}
        </p>
      </div>
    </Link>
  );
}
