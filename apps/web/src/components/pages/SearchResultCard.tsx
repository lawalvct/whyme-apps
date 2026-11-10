'use client';

import Link from 'next/link';
import type { PublicListing, PublicProfile } from '@whyme/data';
import { CategoryName } from '@/components/market/CategoryName';
import { Photo } from '@/components/market/Photo';
import { Price } from '@/components/market/Price';
import { VerifiedBadge } from '@/components/market/VerifiedBadge';
import { MarketplaceIcon as Icon } from '@/components/ui/MarketplaceIcon';
import { routes } from '@/lib/format';
import { useT } from '@/lib/i18n';
import styles from './SearchView.module.css';

export function SearchListingCard({ listing, list }: { listing: PublicListing; list: boolean }) {
  const { t } = useT('market');
  return <Link href={routes.listing(listing)} className={styles.listingCard} data-layout={list ? 'list' : 'grid'}>
    <div className={styles.listingImage}><Photo src={listing.photos[0]?.urls.medium} alt={listing.title} className={styles.listingPhoto} /><span className={styles.kindBadge}><Icon name={listing.kind === 'product' ? 'bag' : 'tools'} />{t(listing.kind === 'product' ? 'searchProductLabel' : 'searchServiceLabel')}</span><span className={styles.openCard}><Icon name="arrow" /></span></div>
    <div className={styles.listingBody}>
      <span className={styles.cardCategory}><CategoryName id={listing.category.id} fallback={listing.category.name} /></span>
      <h3>{listing.title}</h3>
      {list && <p className={styles.cardDescription}>{listing.description}</p>}
      <Price kobo={listing.price_kobo} kind={listing.kind} className={styles.cardPrice} />
      <div className={styles.cardLocation}><Icon name="pin" /><span>{listing.location.name}</span>{listing.kind === 'product' && !listing.in_stock && <span className={styles.outOfStock}>{t('outOfStock')}</span>}</div>
      <div className={styles.cardSeller}><span className={styles.sellerIcon}><Icon name="shop" /></span><span>{listing.seller.name}</span>{listing.seller.verified && <span className={styles.sellerVerified} title={t('verifiedHint')}><Icon name="shield" /><span>{t('verified')}</span></span>}</div>
    </div>
  </Link>;
}

export function SearchProfileCard({ profile }: { profile: PublicProfile }) {
  const { t } = useT('market');
  return <Link href={routes.profile(profile)} className={styles.profileCard}>
    <div className={styles.profileIdentity}><Photo src={profile.logo?.medium} alt={profile.display_name} className={styles.profilePhoto} /><div><span className={styles.cardCategory}><CategoryName id={profile.category.id} fallback={profile.category.name} /></span><h3>{profile.display_name}</h3><span className={styles.cardLocation}><Icon name="pin" />{profile.location.name}</span></div></div>
    {profile.about && <p className={styles.profileAbout}>{profile.about}</p>}
    <div className={styles.profileMeta}>{profile.verified && <VerifiedBadge />}{profile.years_experience ? <span><Icon name="tools" />{t('experience', { count: profile.years_experience })}</span> : null}</div>
    <div className={styles.profileFooter}><span>{t('viewProfile')}</span><Icon name="arrow" /></div>
  </Link>;
}
