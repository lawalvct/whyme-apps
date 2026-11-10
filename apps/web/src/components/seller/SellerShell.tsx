'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, type ReactNode } from 'react';
import { PhoneConfirmed } from '@/components/auth/ConfirmPhone';
import { MarketplaceIcon as Icon, type MarketplaceIconName } from '@/components/ui/MarketplaceIcon';
import { Skeleton } from '@/components/ui/skeleton';
import { routes } from '@/lib/format';
import { useT } from '@/lib/i18n';
import { useAccount } from '@/lib/session';
import { sellerCapabilities } from './common';
import styles from './SellerCentre.module.css';

/**
 * The seller centre frame: its own navigation, and signed-out visitors are sent
 * to sign-in and brought back to the page they asked for. The page itself is
 * always rendered (each one waits for the account with <SignedInOnly>), so Next
 * can validate it for instant navigation.
 */
export function SellerShell({ children }: { children: ReactNode }) {
  const { t } = useT('seller');
  const { user, status } = useAccount();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (status === 'signed_out') router.replace(routes.signIn(window.location.pathname + window.location.search));
  }, [status, router]);

  const caps = sellerCapabilities(user);
  const links: { href: string; label: string; icon: MarketplaceIconName; exact: boolean }[] = [
    { href: routes.sell, label: t('navOverview'), icon: 'grid', exact: true },
    ...(caps.vendor || caps.provider ? [{ href: routes.sellListings(), label: t('navListings'), icon: 'list' as const, exact: false }] : []),
    ...(caps.vendor ? [{ href: routes.sellProfile('business'), label: t('navBusiness'), icon: 'shop' as const, exact: false }] : []),
    ...(caps.provider ? [{ href: routes.sellProfile('provider'), label: t('navProvider'), icon: 'tools' as const, exact: false }] : []),
    ...(caps.vendor ? [{ href: routes.orders('sold'), label: t('navOrders'), icon: 'bag' as const, exact: false }] : []),
    ...(caps.vendor || caps.provider ? [{ href: routes.sellPayouts, label: t('navPayouts'), icon: 'wallet' as const, exact: false }] : []),
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
 * Shows a placeholder until the signed-in account is known; signed-out visitors
 * are redirected by the shell. Accounts whose phone isn't confirmed yet (signed
 * up with a code by email) confirm it by SMS first.
 */
export function SignedInOnly({ children }: { children: ReactNode }) {
  const { t } = useT('seller');
  const { status } = useAccount();

  if (status !== 'signed_in') {
    return (
      <div className="flex flex-col gap-4" aria-busy>
        <p className="sr-only" role="status">
          {status === 'signed_out' ? t('redirecting') : t('common:loading')}
        </p>
        <Skeleton className="h-10 w-full max-w-md" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }
  return <PhoneConfirmed reason="seller">{children}</PhoneConfirmed>;
}
