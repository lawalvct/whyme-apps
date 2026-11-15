'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { sellerKeys, unwrap, useApi, useMyProfiles, type OwnerProfile, type ProfileKind } from '@whyme/data';
import { Photo } from '@/components/market/Photo';
import { Price } from '@/components/market/Price';
import { MarketplaceIcon as Icon, type MarketplaceIconName } from '@/components/ui/MarketplaceIcon';
import { Skeleton } from '@/components/ui/skeleton';
import { routes } from '@/lib/format';
import { useT } from '@/lib/i18n';
import { useAccount } from '@/lib/session';
import { Notice, sellerCapabilities, StatusBadge, StatusNote } from './common';
import { StartSelling } from './StartSelling';
import styles from './SellerCentre.module.css';

/** An overview of the seller's actual pages and latest listings. */
export function SellerHome() {
  const { t } = useT('seller');
  const { user } = useAccount();
  const api = useApi();
  const caps = sellerCapabilities(user);
  const isSeller = caps.vendor || caps.provider;
  const profiles = useMyProfiles(isSeller);
  const listings = useQuery({
    // Separate from the manager's infinite query, with the same invalidation prefix.
    queryKey: [...sellerKeys.listings({ status: 'all' }), 'overview'],
    queryFn: async () => unwrap(await api.GET('/v1/me/listings')).data,
    enabled: isSeller,
  });

  if (!isSeller) return <StartSelling />;

  const kinds: ProfileKind[] = [...(caps.vendor ? ['business' as const] : []), ...(caps.provider ? ['provider' as const] : [])];
  const profile = (kind: ProfileKind) => profiles.data?.find((p) => p.kind === kind) ?? null;
  const livePages = kinds.filter((kind) => profile(kind)?.status === 'published').length;
  const recent = listings.data?.slice(0, 3) ?? [];
  const shortcuts: { href: string; icon: MarketplaceIconName; title: string; hint: string }[] = [
    { href: routes.sellListings(), icon: 'grid', title: t('navListings'), hint: t('overview.listingsShortcut') },
    { href: routes.messages, icon: 'message', title: t('overview.messages'), hint: t('overview.messagesShortcut') },
    ...(caps.vendor ? [{ href: routes.orders('sold'), icon: 'bag' as const, title: t('navOrders'), hint: t('overview.ordersShortcut') }] : []),
    ...(caps.provider ? [{ href: routes.requests('received'), icon: 'tools' as const, title: t('navRequests'), hint: t('overview.requestsShortcut') }] : []),
    { href: routes.sellPayouts, icon: 'wallet', title: t('navPayouts'), hint: t('overview.payoutsShortcut') },
  ];

  return (
    <div className={styles.home}>
      <section className={styles.hero} aria-labelledby="seller-welcome">
        <div className={styles.heroCopy}>
          <span className={styles.heroEyebrow}><span />{t('overview.eyebrow')}</span>
          <h1 id="seller-welcome">{t('hello', { name: user?.first_name ?? '' })}{' '}<span>{t('overview.heroTitle')}</span></h1>
          <p>{t('overview.heroIntro')}</p>
          <div className={styles.heroActions}>
            {caps.vendor && <Link href={routes.newListing('product')} className={styles.goldButton}><Icon name="plus" />{t('addProduct')}</Link>}
            {caps.provider && <Link href={routes.newListing('service')} className={caps.vendor ? styles.heroSecondary : styles.goldButton}><Icon name="plus" />{t('addService')}</Link>}
          </div>
        </div>
        <div className={styles.readiness}>
          <span className={styles.readinessIcon}><Icon name="shop" /></span>
          <span className={styles.heroEyebrow}>{t('overview.yourStorefront')}</span>
          {profiles.isPending ? <Skeleton className="h-9 w-28" /> : profiles.isError ? <strong className={styles.unavailable}>{t('overview.pagesUnavailable')}</strong> : <strong>{livePages}<span> / {kinds.length}</span></strong>}
          <p>{t('overview.pagesLive')}</p>
          <span className={styles.readinessHint}>{t(livePages === kinds.length ? 'overview.pagesReady' : 'overview.pagesHint')}</span>
          {!profiles.isError && <a href="#seller-pages">{t(livePages === kinds.length ? 'overview.managePages' : 'overview.finishPages')}<Icon name="arrow" /></a>}
        </div>
      </section>

      <nav aria-label={t('overview.quickActions')} className={styles.shortcuts} data-count={shortcuts.length}>
        {shortcuts.map((item) => <Link href={item.href} key={item.href}><span className={styles.shortcutIcon}><Icon name={item.icon} /></span><span><strong>{item.title}</strong><small>{item.hint}</small></span><Icon name="arrow" /></Link>)}
      </nav>

      <div className={styles.dashboardGrid}>
        <div className={styles.mainColumn}>
          <section id="seller-pages" className={styles.pagesSection} aria-labelledby="seller-pages-heading">
            <header className={styles.sectionHeader}><div><span className={styles.eyebrow}>{t('overview.makeItYours')}</span><h2 id="seller-pages-heading">{t('overview.yourPages')}</h2><p>{t('overview.pagesIntro')}</p></div><Icon name="shop" /></header>
            {profiles.isError ? <div className={styles.queryError}><Notice tone="error">{t('overview.profilesError')}</Notice><button type="button" onClick={() => void profiles.refetch()} disabled={profiles.isFetching}>{t(profiles.isFetching ? 'common:loading' : 'overview.tryAgain')}</button></div> : <div className={styles.profileGrid}>{kinds.map((kind) => <ProfileCard key={kind} kind={kind} profile={profile(kind)} loading={profiles.isPending} />)}</div>}
          </section>

          <section className={styles.recentPanel} aria-labelledby="seller-recent-heading">
            <header className={styles.sectionHeader}><div><span className={styles.eyebrow}>{t('overview.keepThingsMoving')}</span><h2 id="seller-recent-heading">{t('overview.recentListings')}</h2></div><Link href={routes.sellListings()} className={styles.textLink}>{t('overview.viewAll')}<Icon name="arrow" /></Link></header>
            {listings.isPending ? <div className={styles.listingSkeletons}><Skeleton className="h-20 w-full" /><Skeleton className="h-20 w-full" /></div> : listings.isError ? <div className={styles.queryError}><Notice tone="error">{t('overview.listingsError')}</Notice><button type="button" onClick={() => void listings.refetch()} disabled={listings.isFetching}>{t(listings.isFetching ? 'common:loading' : 'overview.tryAgain')}</button></div> : recent.length ? <ul className={styles.recentList}>{recent.map((listing) => <li key={listing.id}><Link href={routes.editListing(listing.id)}><Photo src={listing.photos[0]?.urls.thumb} alt="" className={styles.listingPhoto} /><div className={styles.listingInfo}><StatusBadge status={listing.status} /><h3>{listing.title}</h3><Price kobo={listing.price_kobo} kind={listing.kind} /></div><Icon name="arrow" /></Link></li>)}</ul> : <div className={styles.emptyListings}><span><Icon name="bag" /></span><h3>{t('overview.emptyTitle')}</h3><p>{t('overview.emptyHint')}</p><Link href={routes.newListing(caps.vendor ? 'product' : 'service')} className={styles.greenButton}><Icon name="plus" />{t(caps.vendor ? 'addProduct' : 'addService')}</Link></div>}
          </section>
        </div>

        <aside className={styles.sideColumn} aria-label={t('overview.sellerGuidance')}>
          <section className={styles.tipsPanel}><span className={styles.eyebrow}>{t('overview.smallDetails')}</span><h2>{t('overview.tipsTitle')}</h2><ol>{(['Photos', 'Details', 'Chat'] as const).map((tip, i) => <li key={tip}><span>{String(i + 1).padStart(2, '0')}</span><div><h3>{t(`overview.tip${tip}Title`)}</h3><p>{t(`overview.tip${tip}Body`)}</p></div></li>)}</ol></section>
          <section className={styles.protectionPanel}><span className={styles.protectionIcon}><Icon name="shield" /></span><span className={styles.eyebrow}>{t('overview.sellWithConfidence')}</span><h2>{t('overview.protectionTitle')}</h2><p>{t('overview.protectionHint')}</p><Link href={routes.sellPayouts}>{t('overview.managePayouts')}<Icon name="arrow" /></Link></section>
        </aside>
      </div>
      {caps.vendor && caps.provider ? null : <StartSelling only={caps.vendor ? 'provider' : 'vendor'} compact />}
    </div>
  );
}

function ProfileCard({ kind, profile, loading }: { kind: ProfileKind; profile: OwnerProfile | null; loading: boolean }) {
  const { t } = useT('seller');
  return (
    <section className={styles.profileCard}>
      <div className={styles.profileTop}><span className={styles.profileIcon}><Icon name={kind === 'business' ? 'shop' : 'tools'} /></span>{loading ? <Skeleton className="h-5 w-20" /> : profile ? <StatusBadge status={profile.status} /> : <span className={styles.notStarted}>{t('notStarted')}</span>}</div>
      <span className={styles.profileType}>{t(kind === 'business' ? 'businessPage' : 'providerPage')}</span>
      {loading ? <div className={styles.profileLoading}><Skeleton className="h-6 w-3/4" /><Skeleton className="h-14 w-full" /></div> : <><h3>{profile?.display_name || t(kind === 'business' ? 'overview.businessTitle' : 'overview.providerTitle')}</h3>{profile ? <div className={styles.profileStatus}><StatusNote status={profile.status} reason={profile.status_reason} /></div> : <p>{t(kind === 'business' ? 'businessPageHint' : 'providerPageHint')}</p>}</>}
      <div className={styles.profileActions}>{!loading && <><Link href={routes.sellProfile(kind)} className={styles.profileEdit}>{t(profile?.status === 'pending_review' ? 'view' : profile ? 'editPage' : 'setUpPage')}<Icon name="arrow" /></Link>{profile?.status === 'published' && <Link href={routes.profile(profile)} className={styles.textLink}>{t('viewPage')}</Link>}</>}</div>
    </section>
  );
}
