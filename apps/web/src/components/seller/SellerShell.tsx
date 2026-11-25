'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { RequireAccount } from '@/components/auth/RequireAccount';
import { MarketplaceIcon as Icon, type MarketplaceIconName } from '@/components/ui/MarketplaceIcon';
import { routes } from '@/lib/format';
import { useT } from '@/lib/i18n';
import { useAccount } from '@/lib/session';
import { sellerCapabilities } from './common';
import styles from './SellerCentre.module.css';

/**
 * The seller centre frame and its own navigation. The page itself is always
 * rendered, so Next can validate it for instant navigation; each page waits for
 * the account with <SignedInOnly> or <RequireAccount>, which also sends
 * signed-out visitors to sign-in and back to the page they asked for.
 */
export function SellerShell({ children }: { children: ReactNode }) {
  const { t } = useT('seller');
  const { user, status } = useAccount();
  const pathname = usePathname();

  const caps = sellerCapabilities(user);
  const links: { href: string; label: string; icon: MarketplaceIconName; exact: boolean }[] = [
    { href: routes.sell, label: t('navOverview'), icon: 'grid', exact: true },
    ...(caps.vendor || caps.provider ? [{ href: routes.sellListings(), label: t('navListings'), icon: 'list' as const, exact: false }] : []),
    ...(caps.vendor ? [{ href: routes.sellProfile('business'), label: t('navBusiness'), icon: 'shop' as const, exact: false }] : []),
    ...(caps.provider ? [{ href: routes.sellProfile('provider'), label: t('navProvider'), icon: 'tools' as const, exact: false }] : []),
    ...(caps.vendor ? [{ href: routes.orders('sold'), label: t('navOrders'), icon: 'bag' as const, exact: false }] : []),
    ...(caps.provider ? [{ href: routes.requests('received'), label: t('navRequests'), icon: 'tools' as const, exact: false }] : []),
    { href: routes.sellJobs, label: t('navEmployer'), icon: 'user' as const, exact: false },
    ...(caps.vendor || caps.provider ? [{ href: routes.sellPayouts, label: t('navPayouts'), icon: 'wallet' as const, exact: false }] : []),
    { href: routes.sellBilling, label: t('navBilling'), icon: 'sparkle' as const, exact: false },
  ];

  return (
    <div className={styles.shell}>
      <div className={styles.shellHeading}><Link href={routes.home}>{t('market:home')}</Link><Icon name="chevron" /><span>{t('centre')}</span><span className={styles.privateLabel}><Icon name="shield" />{t('overview.yourWorkspace')}</span></div>
      <nav aria-label={t('centre')} className={styles.sellerNavigation}>
        <ul>
          {status === 'signed_in'
            ? links.map((link) => {
                const active = link.exact ? pathname === link.href : pathname.startsWith(link.href);
                return (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      aria-current={active ? 'page' : undefined}
                      className={styles.sellerNavLink}
                    >
                      <Icon name={link.icon} />{link.label}
                    </Link>
                  </li>
                );
              })
            : null}
        </ul>
      </nav>
      {children}
    </div>
  );
}

/**
 * A seller centre page: a placeholder until the signed-in account is known, then
 * the page. Signed-out visitors go to sign-in and come back (it no longer relies
 * on the shell for that, so it is safe on any page). Accounts whose phone isn't
 * confirmed yet (signed up with a code by email) confirm it by SMS first.
 */
export function SignedInOnly({ children }: { children: ReactNode }) {
  return <RequireAccount phone="seller">{children}</RequireAccount>;
}
