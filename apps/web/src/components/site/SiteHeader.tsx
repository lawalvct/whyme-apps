'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  chatKeys,
  jobKeys,
  orderKeys,
  queryKeys,
  requestKeys,
  savedKeys,
  sellerKeys,
  notificationKeys,
  useApi,
  useOrderCounts,
  useServiceRequestCounts,
  useUnreadMessages,
  useUnreadNotifications,
} from '@whyme/data';
import { isSupportedLanguage, languages } from '@whyme/i18n';
import { useSignOutGuard } from '@/components/auth/SignOutGuard';
import { buttonClass } from '@/components/ui/button';
import { MarketplaceIcon as Icon } from '@/components/ui/MarketplaceIcon';
import { useRotatingContent } from '@/components/ui/useRotatingContent';
import { routes } from '@/lib/format';
import { setLanguage, useLanguage, useT } from '@/lib/i18n';
import { forgetAccountOnThisDevice } from '@/lib/offline';
import { useUserEvents } from '@/lib/realtime';
import { useAccount } from '@/lib/session';
import styles from './SiteHeader.module.css';

// Sample announcements; replace these keys with the active campaign copy at launch.
const announcements = [
  { text: 'announcementChristmas', short: 'announcementChristmasShort', href: routes.search({ q: 'Christmas' }), icon: 'gift' },
  { text: 'announcementIgbo', short: 'announcementIgboShort', href: routes.search({ type: 'people', kind: 'business' }), icon: 'shop' },
  { text: 'announcementSelling', short: 'announcementSellingShort', href: routes.sell, icon: 'sparkle' },
] as const;

export function SiteHeader() {
  const { t } = useT('market');
  const { t: tAuth } = useT('auth');
  const { t: tSeller } = useT('seller');
  const router = useRouter();
  const pathname = usePathname();
  const [query, setQuery] = useState('');

  function onSearch(event: FormEvent) {
    event.preventDefault();
    router.push(routes.search({ q: query.trim() || undefined }));
  }

  if (pathname === '/signin' || pathname === '/signup') {
    return <header className={`${styles.header} ${styles.authHeader}`}><div className={`${styles.container} ${styles.authRow}`}><Link href={routes.home} className={styles.brand} aria-label="WHY ME"><Image src="/brand/whyme-logo-full.png" alt="WHY ME" width={176} height={41} preload /><span>{t('brandTagline')}</span></Link><div className={styles.authActions}><Link href={routes.home} className={styles.authBack} aria-label={tAuth('ui.backToMarketplace')}><Icon name="arrow" /><span>{tAuth('ui.backToMarketplace')}</span></Link><LanguageToggle /></div></div></header>;
  }

  return (
    <header className={styles.header}>
      <div className={styles.utility}>
        <div className={styles.container}>
          <Announcement />
          <div className={styles.utilityActions}>
            <div className={styles.socialLinks}>
              <a href="https://www.facebook.com/whyme" target="_blank" rel="noopener noreferrer" aria-label="WHY ME on Facebook"><Icon name="facebook" /></a>
              <a href="https://x.com/whyme" target="_blank" rel="noopener noreferrer" aria-label="WHY ME on X"><Icon name="x" /></a>
            </div>
            <LanguageToggle />
          </div>
        </div>
      </div>

      <div className={`${styles.container} ${styles.mainRow}`}>
        <Link href={routes.home} className={styles.brand} aria-label="WHY ME">
          <Image src="/brand/whyme-logo-full.png" alt="WHY ME" width={176} height={41} preload />
          <span>{t('brandTagline')}</span>
        </Link>

        <form role="search" onSubmit={onSearch} className={styles.search}>
          <Icon name="search" className={styles.searchIcon} />
          <label htmlFor="site-search" className="sr-only">{t('search')}</label>
          <input id="site-search" type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t('marketplaceSearchPlaceholder')} />
          <span className={styles.searchLocation}><Icon name="pin" />{t('allAreas')}</span>
          <button type="submit" aria-label={t('search')}><Icon name="search" /></button>
        </form>

        <div className={styles.account}>
          <AccountArea signInLabel={tAuth('signIn')} sellLabel={t('sell')} sellerLabel={tSeller('centre')} signOutLabel={tAuth('signOut')} />
        </div>
      </div>

      <div className={styles.navBar}>
        <nav className={`${styles.container} ${styles.navigation}`} aria-label={t('mainNavigation')}>
          <details
            className={styles.categories}
            onClick={(event) => { if (event.target instanceof Element && event.target.closest('a')) event.currentTarget.open = false; }}
            onMouseLeave={(event) => { event.currentTarget.open = false; }}
            onBlur={(event) => {
              if (!(event.relatedTarget instanceof Node) || !event.currentTarget.contains(event.relatedTarget)) {
                event.currentTarget.open = false;
              }
            }}
          >
            <summary aria-label={t('allCategories')}><Icon name="grid" /><span>{t('allCategories')}</span><Icon name="chevron" /></summary>
            <div className={styles.categoryMenu}>
              <Link href={routes.search({ kind: 'product' })}><Icon name="bag" />{t('products')}</Link>
              <Link href={routes.search({ kind: 'service' })}><Icon name="tools" />{t('services')}</Link>
              <Link href={routes.jobs()}><Icon name="list" />{t('jobs')}</Link>
              <Link href={routes.search({ type: 'people', kind: 'business' })}><Icon name="shop" />{t('businesses')}</Link>
              <Link href={routes.search({ type: 'people', kind: 'provider' })}><Icon name="user" />{t('providers')}</Link>
            </div>
          </details>
          <div className={styles.navLinks}>
            <Link href={routes.home} aria-current={pathname === '/' ? 'page' : undefined}>{t('home')}</Link>
            <Link href={routes.search({ kind: 'product' })}>{t('products')}</Link>
            <Link href={routes.search({ kind: 'service' })}>{t('services')}</Link>
            <Link href={routes.jobs()} aria-current={pathname.startsWith('/jobs') ? 'page' : undefined}>{t('jobs')}</Link>
            <Link href={routes.search({ type: 'people', kind: 'business' })}>{t('businesses')}</Link>
            <Link href={routes.search({ type: 'people', kind: 'provider' })}>{t('providers')}</Link>
          </div>
          <span className={styles.navLocation}><Icon name="pin" />{t('deltaNigeria')}</span>
        </nav>
      </div>
    </header>
  );
}

function Announcement() {
  const { t } = useT('market');
  const rotation = useRotatingContent(announcements.length, 6000);
  const announcement = announcements[rotation.index];

  return (
    <div className={styles.announcement} aria-label={t('announcements')}
      onMouseEnter={() => rotation.setInteracting(true)} onMouseLeave={() => rotation.setInteracting(false)}
      onFocusCapture={() => rotation.setInteracting(true)}
      onBlurCapture={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) rotation.setInteracting(false); }}>
      <Icon name={announcement.icon} className={styles.announcementIcon} />
      <div className={styles.announcementMessage} aria-live={rotation.paused ? 'polite' : 'off'}>
        <Link key={announcement.text} href={announcement.href}><span className={styles.announcementFull}>{t(announcement.text)}</span><span className={styles.announcementShort}>{t(announcement.short)}</span></Link>
      </div>
      <button type="button" onClick={rotation.togglePaused} aria-label={t(rotation.paused ? 'playAnnouncements' : 'pauseAnnouncements')}><Icon name={rotation.paused ? 'play' : 'pause'} /></button>
      <button type="button" onClick={() => rotation.select(rotation.index + 1)} aria-label={t('nextAnnouncement')}><Icon name="arrow" /></button>
    </div>
  );
}

function LanguageToggle() {
  const { t } = useT('market');
  const language = useLanguage();
  return (
    <label className={styles.language}>
      <Icon name="globe" />
      <span className="sr-only">{t('language')}</span>
      <select value={language} onChange={(event) => { const code = event.target.value; if (isSupportedLanguage(code)) void setLanguage(code); }}>
        {languages.filter((l) => l.enabled).map((l) => <option key={l.code} value={l.code} lang={l.code}>{l.nativeName}</option>)}
      </select>
    </label>
  );
}

function AccountArea({
  signInLabel,
  sellLabel,
  sellerLabel,
  signOutLabel,
}: {
  signInLabel: string;
  sellLabel: string;
  sellerLabel: string;
  signOutLabel: string;
}) {
  const { t } = useT('market');
  const { t: tSettings } = useT('settings');
  const { user } = useAccount();
  const api = useApi();
  const queryClient = useQueryClient();
  const router = useRouter();
  const guard = useSignOutGuard();

  if (!user) {
    return (
      <>
        <Link href={routes.signIn()} className={styles.signIn} aria-label={signInLabel}>
          <Icon name="user" />
          <span><small>{t('welcomeBack')}</small><strong>{signInLabel}<span className={styles.joinLabel}> / {t('join')}</span></strong></span>
        </Link>
        <Link href={routes.signUp(routes.sell)} className={styles.sellButton}>
          <Icon name="plus" /><span>{sellLabel}</span>
        </Link>
      </>
    );
  }

  async function signOut() {
    // Unsent changes would be lost with this account's browser data: ask first.
    if (!(await guard.confirm())) return;
    await api.POST('/v1/auth/logout');
    await forgetAccountOnThisDevice();
    // Leaving a private page (seller centre, messages): a full load of the home page drops
    // everything the account had in memory (and beats those pages' own sign-in redirect).
    if ([routes.sell, routes.messages, routes.notifications, routes.orders(), routes.requests(), routes.saved, routes.account, '/checkout'].some((path) => window.location.pathname.startsWith(path))) {
      window.location.assign(routes.home);
      return;
    }
    queryClient.removeQueries({ queryKey: sellerKeys.all });
    queryClient.removeQueries({ queryKey: chatKeys.all });
    queryClient.removeQueries({ queryKey: orderKeys.all });
    queryClient.removeQueries({ queryKey: requestKeys.all });
    queryClient.removeQueries({ queryKey: jobKeys.all });
    queryClient.removeQueries({ queryKey: savedKeys.all });
    queryClient.removeQueries({ queryKey: notificationKeys.all });
    queryClient.setQueryData(queryKeys.me, null);
    await queryClient.invalidateQueries({ queryKey: queryKeys.me });
    router.refresh();
  }

  return (
    <div className="flex items-center gap-2">
      {guard.dialog}
      <SavedLink />
      <NotificationsLink userId={user.id} />
      <MessagesLink enabled={Boolean(user.phone_verified_at)} />
      <OrdersLink enabled={Boolean(user.phone_verified_at)} />
      <RequestsLink enabled={Boolean(user.phone_verified_at)} />
      <Link href={routes.sell} className={buttonClass('ghost', 'min-h-11 px-3 text-sm')}>
        {sellerLabel}
      </Link>
      <Link href={routes.account} className={buttonClass('ghost', 'min-h-11 gap-2 px-3 text-sm')} aria-label={tSettings('account.menuLabel')} title={tSettings('account.menuLabel')}>
        <Icon name="user" />
        <span className="hidden max-w-32 truncate font-medium min-[1600px]:inline">{user.first_name}</span>
      </Link>
      <button type="button" onClick={() => void signOut()} className={buttonClass('secondary', 'min-h-11 px-3 text-sm')}>
        {signOutLabel}
      </button>
    </div>
  );
}

/** Orders bought and sold: an icon on small screens. */
/** Orders bought and sold, with how many wait for you (to accept, send or confirm). An icon on small screens. */
function OrdersLink({ enabled }: { enabled: boolean }) {
  const { t } = useT('orders');
  const counts = useOrderCounts(enabled).data;
  const waiting = (counts?.selling ?? 0) + (counts?.buying ?? 0);

  return (
    <Link
      href={routes.orders(counts && counts.selling > 0 && counts.buying === 0 ? 'sold' : undefined)}
      aria-label={waiting > 0 ? t('ordersWaiting', { count: waiting }) : t('orders')}
      title={t('orders')}
      className={buttonClass('ghost', 'relative min-h-11 px-3 text-sm')}
    >
      <svg aria-hidden viewBox="0 0 24 24" className="size-5 fill-none stroke-current" strokeWidth={1.8} strokeLinejoin="round">
        <path d="M5 8h14l-1 12H6L5 8z" />
        <path d="M9 8V6a3 3 0 0 1 6 0v2" />
      </svg>
      <span className="hidden min-[1600px]:inline">{t('orders')}</span>
      {waiting > 0 ? (
        <span className="absolute top-1 right-1 min-w-5 rounded-full bg-accent px-1.5 text-center text-xs font-bold text-text">
          {waiting > 99 ? '99+' : waiting}
        </span>
      ) : null}
    </Link>
  );
}

/** Service requests requested and received, with how many wait for you. */
function RequestsLink({ enabled }: { enabled: boolean }) {
  const { t } = useT('requests');
  const counts = useServiceRequestCounts(enabled).data;
  const waiting = (counts?.provider ?? 0) + (counts?.customer ?? 0);

  return (
    <Link
      href={routes.requests(counts && counts.provider > 0 && counts.customer === 0 ? 'received' : undefined)}
      aria-label={waiting > 0 ? t('requestsWaiting', { count: waiting }) : t('requestsTitle')}
      title={t('requestsTitle')}
      className={buttonClass('ghost', 'relative min-h-11 px-3 text-sm')}
    >
      {/* Icon only (the name shows on hover): its label is the widest and never fits beside a usable search box. */}
      <Icon name="tools" className="size-5" />
      {waiting > 0 ? (
        <span className="absolute top-1 right-1 min-w-5 rounded-full bg-accent px-1.5 text-center text-xs font-bold text-text">
          {waiting > 99 ? '99+' : waiting}
        </span>
      ) : null}
    </Link>
  );
}

/**
 * Saved items: readable offline. The heart alone (its name shows on hover): signed in, the header
 * has room for text on Messages, Orders and the name only, and the search box comes first.
 */
function SavedLink() {
  const { t } = useT('market');
  return (
    <Link href={routes.saved} aria-label={t('savedTitle')} title={t('savedTitle')} className={buttonClass('ghost', 'min-h-11 px-3 text-sm')}>
      <Icon name="heart" className="size-5" />
    </Link>
  );
}

/** The bell: unread notifications, refreshed live when one arrives (and every minute as a safety net). */
function NotificationsLink({ userId }: { userId: string }) {
  const { t } = useT('notifications');
  const queryClient = useQueryClient();
  const unread = useUnreadNotifications(true).data ?? 0;
  useUserEvents(userId, {
    'notification.created': () => void queryClient.invalidateQueries({ queryKey: notificationKeys.all }),
  });

  return (
    <Link
      href={routes.notifications}
      aria-label={unread > 0 ? t('navUnread', { count: unread }) : t('nav')}
      className={buttonClass('ghost', 'relative min-h-11 px-3 text-sm')}
    >
      <Icon name="bell" className="size-5" />
      {unread > 0 ? (
        <span className="absolute top-1 right-1 min-w-5 rounded-full bg-accent px-1.5 text-center text-xs font-bold text-text">
          {unread > 99 ? '99+' : unread}
        </span>
      ) : null}
    </Link>
  );
}

/** Messages, with the unread count (checked every 30 seconds; chat needs a confirmed phone). */
function MessagesLink({ enabled }: { enabled: boolean }) {
  const { t } = useT('chat');
  const unread = useUnreadMessages(enabled).data ?? 0;

  return (
    <Link
      href={routes.messages}
      aria-label={unread > 0 ? t('messagesUnread', { count: unread }) : t('messages')}
      title={t('messages')}
      className={buttonClass('ghost', 'relative min-h-11 px-3 text-sm')}
    >
      <svg aria-hidden viewBox="0 0 24 24" className="size-5 fill-none stroke-current" strokeWidth={1.8} strokeLinejoin="round">
        <path d="M4 5h16v11H9l-5 4V5z" />
      </svg>
      <span className="hidden min-[1600px]:inline">{t('messages')}</span>
      {unread > 0 ? (
        <span className="absolute top-1 right-1 min-w-5 rounded-full bg-accent px-1.5 text-center text-xs font-bold text-text">
          {unread > 99 ? '99+' : unread}
        </span>
      ) : null}
    </Link>
  );
}
