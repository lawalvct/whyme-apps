'use client';

import Link from 'next/link';
import { useRef, useState } from 'react';
import { useTaxonomy, type PublicListing } from '@whyme/data';
import { CategoryName } from '@/components/market/CategoryName';
import { ContactActions } from '@/components/market/ContactActions';
import { SaveButton } from '@/components/market/SaveButton';
import { ListingGallery } from '@/components/market/ListingGallery';
import { Price } from '@/components/market/Price';
import { ReturnsPolicy } from '@/components/market/ReturnsPolicy';
import { VerifiedBadge } from '@/components/market/VerifiedBadge';
import { MarketplaceIcon as Icon } from '@/components/ui/MarketplaceIcon';
import { routes } from '@/lib/format';
import { useLanguage, useT } from '@/lib/i18n';
import { SearchListingCard } from './SearchResultCard';
import styles from './ListingView.module.css';

export function ListingView({ listing, related = [] }: { listing: PublicListing; related?: PublicListing[] }) {
  const { t } = useT('market');
  const language = useLanguage();
  const { data: taxonomy } = useTaxonomy();
  const [copiedFor, setCopiedFor] = useState<string | null>(null);
  const [copyError, setCopyError] = useState<string | null>(null);
  const [copying, setCopying] = useState(false);
  const copyLock = useRef(false);
  const isProduct = listing.kind === 'product';
  const categoryHref = routes.search({ kind: listing.kind, category_id: listing.category.id });
  const sellerHref = listing.seller.profile_id ? routes.profile({ id: listing.seller.profile_id, slug: listing.seller.profile_slug }) : null;
  const sellerInitials = listing.seller.name.trim().split(/\s+/).slice(0, 2).map((word) => word[0]).join('');
  const fulfilment = listing.fulfilment.filter((value): value is 'pickup' | 'delivery' => value === 'pickup' || value === 'delivery');
  const serviceAreas = (taxonomy?.locations ?? []).filter((location) => listing.service_area_ids.some((id) => Number(id) === location.id));
  const published = listing.published_at && Number.isFinite(Date.parse(listing.published_at)) ? new Intl.DateTimeFormat(language === 'ig' ? 'ig-NG' : 'en-NG', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Africa/Lagos' }).format(new Date(listing.published_at)) : null;

  async function copyLink() {
    if (copyLock.current) return;
    copyLock.current = true;
    setCopying(true);
    setCopyError(null);
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopiedFor(listing.id);
    } catch {
      setCopyError(listing.id);
    } finally {
      copyLock.current = false;
      setCopying(false);
    }
  }

  return (
    <article className={styles.page}>
      <nav className={styles.breadcrumb} aria-label={t('searchBreadcrumb')}><ol><li><Link href={routes.home}>{t('home')}</Link><Icon name="chevron" /></li><li><Link href={routes.search({ kind: listing.kind })}>{t(isProduct ? 'products' : 'services')}</Link><Icon name="chevron" /></li><li><Link href={categoryHref}><CategoryName id={listing.category.id} fallback={listing.category.name} /></Link><Icon name="chevron" /></li><li aria-current="page">{listing.title}</li></ol></nav>
      <div className={styles.toolbar}><Link href={categoryHref} className={styles.backLink}><Icon name="arrow" />{t('listingBackToCategory')}</Link><div className={styles.shareArea}><span role="status" className={styles.copyError}>{copyError === listing.id ? t('listingCopyFailed') : null}</span><SaveButton listing={listing} className={styles.shareButton} /><button type="button" onClick={() => void copyLink()} disabled={copying} className={styles.shareButton}><Icon name={copiedFor === listing.id ? 'check' : 'share'} /><span aria-live="polite">{t(copiedFor === listing.id ? 'listingLinkCopied' : 'listingCopyLink')}</span></button></div></div>

      <div className={styles.detailGrid}>
        <div className={styles.galleryArea}><ListingGallery key={listing.id} photos={listing.photos} title={listing.title} /></div>

        <aside className={styles.summaryArea} aria-label={t('listingBuyingOptions')}>
          <section id="listing-purchase" className={styles.purchasePanel} aria-labelledby="listing-title">
            <div className={styles.productEyebrow}><span><Icon name={isProduct ? 'bag' : 'tools'} />{t(isProduct ? 'searchProductLabel' : 'searchServiceLabel')}</span><Link href={categoryHref}><CategoryName id={listing.category.id} fallback={listing.category.name} /></Link></div>
            <h1 id="listing-title">{listing.title}</h1>
            <div className={styles.listingMeta}><span><Icon name="pin" />{listing.location.name}</span>{published && <span className={styles.published}><span aria-hidden="true">·</span>{t('listingListedOn', { date: published })}</span>}</div>
            <div className={styles.priceArea}><Price kobo={listing.price_kobo} kind={listing.kind} className={styles.price} />{isProduct && <span className={styles.stock} data-available={listing.in_stock}><span />{t(listing.in_stock ? 'inStock' : 'outOfStock')}</span>}</div>
            <p className={styles.priceNote}>{t(listing.price_kobo === null ? 'listingQuoteHint' : isProduct ? 'listingProductPriceHint' : 'listingServicePriceHint')}</p>

            {isProduct && fulfilment.length > 0 && <div className={styles.fulfilmentChips}>{fulfilment.map((value) => <a key={value} href="#listing-delivery"><Icon name={value === 'pickup' ? 'shop' : 'truck'} />{t(value === 'pickup' ? 'listingPickupAvailable' : 'listingSellerDelivery')}</a>)}</div>}
            {!isProduct && listing.availability_note && <div className={styles.availability}><Icon name="check" /><span><strong>{t('availability')}</strong>{listing.availability_note}</span></div>}
            {isProduct && listing.refund_policy && <a href="#listing-delivery" className={styles.returnSummary}><Icon name="return" /><span>{listing.refund_policy.accepts_returns ? t('returns.within', { count: listing.refund_policy.return_days ?? 0 }) : t('listingNoReturns')}</span><Icon name="chevron" /></a>}

            <div className={styles.contactActions}><ContactActions kind={isProduct ? 'product' : 'service'} subject={{ type: 'listing', id: listing.id }} ownerId={listing.seller.id} /></div>
            <div className={styles.paymentNote}><Icon name="shield" /><div><strong>{t('listingProtectedTitle')}</strong><p>{t('protectedPayment')}</p></div></div>
          </section>

          <section className={styles.sellerPanel} aria-labelledby="listing-seller-title"><span className={styles.sectionEyebrow}>{t(isProduct ? 'listingMeetSeller' : 'listingMeetProvider')}</span><div className={styles.sellerIdentity}><span className={styles.sellerAvatar} aria-hidden="true">{sellerInitials || <Icon name="shop" />}</span><div><h2 id="listing-seller-title">{listing.seller.name}</h2><span><Icon name="pin" />{listing.location.name}</span></div></div>{listing.seller.verified && <div className={styles.sellerVerification}><VerifiedBadge /><span>{t('listingDocumentsChecked')}</span></div>}{sellerHref && <Link href={sellerHref} className={styles.profileLink}>{t('listingVisitProfile')}<Icon name="arrow" /></Link>}</section>

          <aside className={styles.safetyPanel} aria-labelledby="listing-safety-title"><span><Icon name="shield" /></span><div><h2 id="listing-safety-title">{t('listingSafetyTitle')}</h2><p>{t('safetyBody')}</p></div></aside>
        </aside>

        <div className={styles.detailsArea}>
          <nav className={styles.detailNavigation} aria-label={t('listingDetailsNavigation')}><a href="#listing-about">{t('about')}</a><a href="#listing-delivery">{t(isProduct ? 'listingDeliveryReturns' : 'listingServiceDetails')}</a><a href="#listing-protection">{t('listingProtectionLink')}</a></nav>

          <section id="listing-about" className={styles.detailsPanel} aria-labelledby="listing-about-title"><span className={styles.sectionEyebrow}>{t('listingTheDetails')}</span><h2 id="listing-about-title">{t(isProduct ? 'listingAboutProduct' : 'listingAboutService')}</h2><p className={styles.description}>{listing.description}</p><dl className={styles.facts}><div><dt>{t('category')}</dt><dd><Link href={categoryHref}><CategoryName id={listing.category.id} fallback={listing.category.name} /></Link></dd></div><div><dt>{t('location')}</dt><dd><Link href={routes.search({ kind: listing.kind, location_id: listing.location.id })}>{listing.location.name}</Link></dd></div><div><dt>{t('listingListingType')}</dt><dd>{t(isProduct ? 'searchProductLabel' : 'searchServiceLabel')}</dd></div>{published && <div><dt>{t('listingPublished')}</dt><dd><time dateTime={listing.published_at!}>{published}</time></dd></div>}</dl></section>

          <section id="listing-delivery" className={styles.detailsPanel} aria-labelledby="listing-delivery-title"><span className={styles.sectionEyebrow}>{t(isProduct ? 'listingPlanAhead' : 'listingAgreeDetails')}</span><h2 id="listing-delivery-title">{t(isProduct ? 'listingDeliveryReturns' : 'listingServiceDetails')}</h2>
            {isProduct ? <><div className={styles.deliveryOptions}>{fulfilment.includes('pickup') && <div><span><Icon name="shop" /></span><div><h3>{t('pickup')}</h3><p>{t('listingPickupHint')}</p></div></div>}{fulfilment.includes('delivery') && <div><span><Icon name="truck" /></span><div><h3>{t('listingSellerDelivery')}</h3><p>{t('listingDeliveryHint')}</p></div></div>}{fulfilment.length === 0 && <p className={styles.mutedCopy}>{t('listingFulfilmentHint')}</p>}</div><div className={styles.returns}><Icon name="return" /><div><h3>{t('returns.label')}</h3>{listing.refund_policy ? <ReturnsPolicy terms={listing.refund_policy} className={styles.returnsText} /> : <p>{t('listingReturnsHint')}</p>}</div></div></> : <><p className={styles.mutedCopy}>{t('listingServiceScopeHint')}</p>{listing.availability_note && <div className={styles.serviceFact}><strong>{t('availability')}</strong><span>{listing.availability_note}</span></div>}{serviceAreas.length > 0 && <div className={styles.serviceFact}><strong>{t('serviceAreas')}</strong><span>{serviceAreas.map((area) => area.name).join(' · ')}</span></div>}</>}
          </section>

          <section id="listing-protection" className={styles.protectionPanel} aria-labelledby="listing-protection-title"><div className={styles.protectionHeading}><span><Icon name="shield" /></span><div><span className={styles.sectionEyebrow}>{t('listingStayOnWhyme')}</span><h2 id="listing-protection-title">{t('listingProtectionHeading')}</h2></div></div><ol>{['Discuss', 'Pay', 'Confirm'].map((step, index) => <li key={step}><span>{String(index + 1).padStart(2, '0')}</span><div><h3>{t(`listingStep${step}Title`)}</h3><p>{t(`listingStep${step}Body`)}</p></div></li>)}</ol></section>
        </div>
      </div>

      {related.length > 0 && <section className={styles.related} aria-labelledby="listing-related-title"><header><div><span className={styles.sectionEyebrow}>{t('listingKeepExploring')}</span><h2 id="listing-related-title">{t('listingMoreFromSeller')}</h2><p>{listing.seller.name}</p></div>{sellerHref && <Link href={sellerHref}>{t('seeAll')}<Icon name="arrow" /></Link>}</header><div className={styles.relatedGrid} data-count={related.length}>{related.map((item) => <SearchListingCard key={item.id} listing={item} list={false} />)}</div></section>}
    </article>
  );
}
