'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useState } from 'react';
import { useTaxonomy, type PublicListing, type PublicProfile, type TaxonomyCategory } from '@whyme/data';
import { CategoryName } from '@/components/market/CategoryName';
import { Photo } from '@/components/market/Photo';
import { Price } from '@/components/market/Price';
import { VerifiedBadge } from '@/components/market/VerifiedBadge';
import { MarketplaceIcon as Icon, type MarketplaceIconName } from '@/components/ui/MarketplaceIcon';
import { routes } from '@/lib/format';
import { useT } from '@/lib/i18n';
import styles from './HomeMarketplace.module.css';

const categoryIcons: Record<string, MarketplaceIconName> = {
  'phones-gadgets': 'phone', 'electronics-appliances': 'bolt', fashion: 'shirt', 'home-kitchen': 'home',
  'health-beauty': 'sparkle', 'food-groceries': 'leaf', 'vehicles-parts': 'car', 'building-materials': 'tools',
  'babies-kids': 'heart', 'other-products': 'bag',
  electrician: 'bolt', plumber: 'droplet', mechanic: 'car', 'hairdresser-barber': 'scissors',
  tailor: 'scissors', cleaner: 'sparkle', painter: 'home', carpenter: 'tools',
};

type HomeMarketplaceProps = {
  products: PublicListing[];
  services: PublicListing[];
  providers: PublicProfile[];
  categories: TaxonomyCategory[];
};

/** Home discovery uses the same public catalogue and routes as search. */
export function HomeMarketplace({ products, services, providers, categories }: HomeMarketplaceProps) {
  const { t } = useT('market');
  const liveTaxonomy = useTaxonomy();
  const allCategories = liveTaxonomy.data?.categories?.length ? liveTaxonomy.data.categories : categories;
  const [selectedCategoryKind, setSelectedCategoryKind] = useState<'product' | 'service' | null>(null);
  const [categoriesExpanded, setCategoriesExpanded] = useState(false);
  const productCategories = allCategories.filter((category) => category.type === 'product');
  const serviceCategories = allCategories.filter((category) => category.type === 'service');
  const categoryKind = selectedCategoryKind ?? (productCategories.length > 0 ? 'product' : 'service');
  const visibleCategories = categoryKind === 'product' ? productCategories : serviceCategories;
  const foodCategory = productCategories.find((category) => category.slug === 'food-groceries');

  return (
    <div className={styles.marketplace}>
      {allCategories.length > 0 && (
        <section className={styles.section} aria-labelledby="browse-categories-title">
          <div className={styles.sectionHeader}>
            <div><span className={styles.kicker}>{t('homeBrowseEyebrow')}</span><h2 id="browse-categories-title">{t('homeBrowseTitle')}</h2></div>
            <div className={styles.categoryToggle} role="group" aria-label={t('category')}>
              {productCategories.length > 0 && <button type="button" aria-pressed={categoryKind === 'product'} onClick={() => { setSelectedCategoryKind('product'); setCategoriesExpanded(false); }}><Icon name="bag" />{t('products')}</button>}
              {serviceCategories.length > 0 && <button type="button" aria-pressed={categoryKind === 'service'} onClick={() => { setSelectedCategoryKind('service'); setCategoriesExpanded(false); }}><Icon name="tools" />{t('services')}</button>}
            </div>
          </div>
          <ul id="home-category-list" className={styles.categoryGrid} data-kind={categoryKind} data-expanded={categoriesExpanded}>
            {visibleCategories.map((category, index) => (
              <li key={category.id}>
                <Link href={routes.search(categoryKind === 'product' ? { kind: 'product', category_id: category.id } : { type: 'people', kind: 'provider', category_id: category.id })} className={styles.categoryCard} data-tone={index % 4}>
                  <span className={styles.categoryIcon}><Icon name={categoryIcons[category.slug] ?? (categoryKind === 'product' ? 'bag' : 'tools')} /></span>
                  <span className={styles.categoryName}><strong><CategoryName id={category.id} fallback={String(category.name.en ?? category.slug)} /></strong><small>{t(categoryKind === 'product' ? 'homeShopCategory' : 'homeFindExpert')}</small></span>
                  <Icon name="arrow" className={styles.categoryArrow} />
                </Link>
              </li>
            ))}
          </ul>
          {visibleCategories.length > 4 && (
            <div className={styles.categoryMore} data-desktop={visibleCategories.length > 8}>
              <button type="button" aria-expanded={categoriesExpanded} aria-controls="home-category-list" onClick={() => setCategoriesExpanded((expanded) => !expanded)}>
                {t(categoriesExpanded ? 'homeShowFewerCategories' : 'loadMore')}<Icon name="chevron" />
              </button>
            </div>
          )}
        </section>
      )}

      {products.length > 0 && (
        <section className={styles.section} aria-labelledby="home-products-title">
          <SectionHeading id="home-products-title" eyebrow="homeProductsEyebrow" title="homeProductsTitle" description="homeProductsDescription" href={routes.search({ kind: 'product' })} action="homeAllProducts" />
          <div className={styles.listingGrid}>{products.slice(0, 4).map((listing) => <HomeListingCard key={listing.id} listing={listing} />)}</div>
        </section>
      )}

      <section className={styles.localEdit} aria-labelledby="local-edit-title">
        <div className={styles.localEditCopy}>
          <span className={styles.kicker}><Icon name="leaf" />{t('homeLocalEyebrow')}</span>
          <h2 id="local-edit-title">{t('homeLocalTitle')}<br /><span>{t('homeLocalAccent')}</span></h2>
          <p>{t('homeLocalDescription')}</p>
          <Link href={routes.search({ kind: 'product', category_id: foodCategory?.id, q: foodCategory ? undefined : 'food' })} className={styles.solidLink}>{t('homeShopLocal')}<Icon name="arrow" /></Link>
        </div>
        <div className={styles.localEditVisual}>
          <span className={styles.localEditCircle} aria-hidden="true" />
          <div className={styles.localEditPhoto}><Image src="/images/igbo-market-man.png" alt={t('igboMarketPhotoAlt')} fill sizes="(max-width: 640px) 240px, 350px" /></div>
          <span className={styles.marketStamp}><Icon name="shop" /><span>{t('homeLocalStamp')}<strong>{t('homeLocalStampAccent')}</strong></span></span>
        </div>
      </section>

      {providers.length > 0 && (
        <section className={styles.experts} aria-labelledby="home-experts-title">
          <SectionHeading id="home-experts-title" eyebrow="homeExpertsEyebrow" title="homeExpertsTitle" description="homeExpertsDescription" href={routes.search({ type: 'people', kind: 'provider' })} action="homeAllExperts" />
          <div className={styles.providerGrid}>{providers.map((profile) => <HomeProviderCard key={profile.id} profile={profile} />)}</div>
          <div className={styles.expertsNote}><Icon name="shield" /><p>{t('homeExpertsNote')}</p></div>
        </section>
      )}

      {services.length > 0 && (
        <section className={styles.section} aria-labelledby="home-services-title">
          <SectionHeading id="home-services-title" eyebrow="homeServicesEyebrow" title="homeServicesTitle" description="homeServicesDescription" href={routes.search({ kind: 'service' })} action="homeAllServices" />
          <div className={styles.listingGrid}>{services.slice(0, 4).map((listing) => <HomeListingCard key={listing.id} listing={listing} />)}</div>
        </section>
      )}

      <section className={styles.sellerBanner} aria-labelledby="home-seller-title">
        <div className={styles.sellerCopy}>
          <span className={styles.sellerEyebrow}><Icon name="shop" />{t('homeSellerEyebrow')}</span>
          <h2 id="home-seller-title">{t('homeSellerTitle')}<br /><span>{t('homeSellerAccent')}</span></h2>
          <p>{t('homeSellerDescription')}</p>
          <Link href={routes.sell} className={styles.goldLink}>{t('homeSellerAction')}<Icon name="arrow" /></Link>
        </div>
        <ol className={styles.sellerSteps}>
          {['Profile', 'Listing', 'Connect'].map((step, index) => <li key={step}><span>{String(index + 1).padStart(2, '0')}</span><div><h3>{t(`homeSeller${step}Title`)}</h3><p>{t(`homeSeller${step}Body`)}</p></div><Icon name={index === 2 ? 'check' : 'arrow'} /></li>)}
        </ol>
      </section>
    </div>
  );
}

function SectionHeading({ id, eyebrow, title, description, href, action }: { id: string; eyebrow: string; title: string; description: string; href: string; action: string }) {
  const { t } = useT('market');
  return <div className={styles.sectionHeader}><div><span className={styles.kicker}>{t(eyebrow)}</span><h2 id={id}>{t(title)}</h2><p>{t(description)}</p></div><Link href={href} className={styles.textLink}>{t(action)}<Icon name="arrow" /></Link></div>;
}

function HomeListingCard({ listing }: { listing: PublicListing }) {
  const { t } = useT('market');
  return (
    <Link href={routes.listing(listing)} className={styles.listingCard}>
      <div className={styles.listingImage}>
        <Photo src={listing.photos[0]?.urls.medium} alt={listing.title} className={styles.listingPhoto} />
        <span className={styles.listingKind}><Icon name={listing.kind === 'product' ? 'bag' : 'tools'} />{t(listing.kind === 'product' ? 'homeLocalFind' : 'homeServiceLabel')}</span>
        <span className={styles.openListing}><Icon name="arrow" /></span>
      </div>
      <div className={styles.listingBody}>
        <span className={styles.listingCategory}><CategoryName id={listing.category.id} fallback={listing.category.name} /></span>
        <h3>{listing.title}</h3>
        <Price kobo={listing.price_kobo} kind={listing.kind} className={styles.listingPrice} />
        {listing.kind === 'product' && !listing.in_stock && <span className={styles.outOfStock}>{t('outOfStock')}</span>}
        <span className={styles.listingLocation}><Icon name="pin" />{listing.location.name}</span>
        <div className={styles.listingSeller}><span className={styles.sellerAvatar}><Icon name="shop" /></span><span>{listing.seller.name}</span>{listing.seller.verified && <Icon name="shield" className={styles.sellerVerified} aria-label={t('verified')} aria-hidden={false} />}</div>
      </div>
    </Link>
  );
}

function HomeProviderCard({ profile }: { profile: PublicProfile }) {
  const { t } = useT('market');
  return (
    <Link href={routes.profile(profile)} className={styles.providerCard}>
      <div className={styles.providerIdentity}>
        <Photo src={profile.logo?.medium} alt={profile.display_name} className={styles.providerPhoto} />
        <div><span className={styles.providerCategory}><CategoryName id={profile.category.id} fallback={profile.category.name} /></span><h3>{profile.display_name}</h3><span className={styles.providerLocation}><Icon name="pin" />{profile.location.name}</span></div>
      </div>
      {profile.about && <p className={styles.providerAbout}>{profile.about}</p>}
      <div className={styles.providerMeta}>{profile.verified && <VerifiedBadge />}{profile.years_experience ? <span><Icon name="tools" />{t('experience', { count: profile.years_experience })}</span> : null}</div>
      <div className={styles.providerFooter}><span>{t('viewProfile')}</span><Icon name="arrow" /></div>
    </Link>
  );
}
