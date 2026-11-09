'use client';

import Link from 'next/link';
import type { PublicListing } from '@whyme/data';
import { Badge } from '@/components/ui/badge';
import { CategoryName } from '@/components/market/CategoryName';
import { ContactActions } from '@/components/market/ContactActions';
import { PhotoGallery } from '@/components/market/PhotoGallery';
import { Price } from '@/components/market/Price';
import { ReturnsPolicy } from '@/components/market/ReturnsPolicy';
import { SafetyNote } from '@/components/market/SafetyNote';
import { VerifiedBadge } from '@/components/market/VerifiedBadge';
import { routes } from '@/lib/format';
import { useT } from '@/lib/i18n';

export function ListingView({ listing }: { listing: PublicListing }) {
  const { t } = useT('market');
  const isProduct = listing.kind === 'product';

  return (
    <article className="grid gap-8 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
      <div className="flex flex-col gap-6">
        <PhotoGallery photos={listing.photos} alt={listing.title} />
        <section>
          <h2 className="mb-2 text-lg font-bold">{t('about')}</h2>
          <p className="whitespace-pre-line text-text">{listing.description}</p>
        </section>
      </div>

      <div className="flex flex-col gap-5">
        <div className="flex flex-col gap-2">
          <p className="text-sm text-text-muted">
            <Link href={routes.search({ kind: listing.kind, category_id: listing.category.id })} className="hover:text-primary hover:underline">
              <CategoryName id={listing.category.id} fallback={listing.category.name} />
            </Link>
          </p>
          <h1 className="text-2xl font-bold leading-snug">{listing.title}</h1>
          <Price kobo={listing.price_kobo} kind={listing.kind} className="text-3xl font-bold text-primary" />
          <div className="flex flex-wrap gap-2">
            {isProduct ? <Badge tone={listing.in_stock ? 'primary' : 'warning'}>{listing.in_stock ? t('inStock') : t('outOfStock')}</Badge> : null}
            <Badge>{listing.location.name}</Badge>
          </div>
        </div>

        {isProduct && listing.fulfilment.length > 0 ? (
          <p className="text-sm">
            <span className="font-semibold">{t('howYouGetIt')}: </span>
            {listing.fulfilment.map((f) => t(String(f))).join(' · ')}
          </p>
        ) : null}
        {listing.availability_note ? (
          <p className="text-sm">
            <span className="font-semibold">{t('availability')}: </span>
            {listing.availability_note}
          </p>
        ) : null}
        <ReturnsPolicy terms={listing.refund_policy} />

        <ContactActions kind={isProduct ? 'product' : 'service'} subject={{ type: 'listing', id: listing.id }} ownerId={listing.seller.id} />
        <p className="text-sm text-text-muted">{t('protectedPayment')}</p>

        <section className="rounded-xl border border-border p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">{isProduct ? t('seller') : t('provider')}</p>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <span className="font-semibold">{listing.seller.name}</span>
            {listing.seller.verified ? <VerifiedBadge /> : null}
          </div>
          {listing.seller.profile_id ? (
            <Link
              href={routes.profile({ id: listing.seller.profile_id, display_name: listing.seller.name ?? '' })}
              className="mt-2 inline-block text-sm font-semibold text-primary hover:underline"
            >
              {t('viewProfile')}
            </Link>
          ) : null}
        </section>

        <SafetyNote />
      </div>
    </article>
  );
}
