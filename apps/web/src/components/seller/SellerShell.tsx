'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, type ReactNode } from 'react';
import { PhoneConfirmed } from '@/components/auth/ConfirmPhone';
import { cn } from '@/components/ui/cn';
import { Skeleton } from '@/components/ui/skeleton';
import { routes } from '@/lib/format';
import { useT } from '@/lib/i18n';
import { useAccount } from '@/lib/session';
import { sellerCapabilities } from './common';

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
  const links = [
    { href: routes.sell, label: t('navOverview'), exact: true },
    ...(caps.vendor || caps.provider ? [{ href: routes.sellListings(), label: t('navListings'), exact: false }] : []),
    ...(caps.vendor ? [{ href: routes.sellProfile('business'), label: t('navBusiness'), exact: false }] : []),
    ...(caps.provider ? [{ href: routes.sellProfile('provider'), label: t('navProvider'), exact: false }] : []),
  ];

  return (
    <div className="flex flex-col gap-6">
      <nav aria-label={t('centre')} className="-mx-4 overflow-x-auto px-4">
        <ul className="flex min-h-12 min-w-max gap-1 border-b border-border">
          {status === 'signed_in'
            ? links.map((link) => {
                const active = link.exact ? pathname === link.href : pathname.startsWith(link.href);
                return (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      aria-current={active ? 'page' : undefined}
                      className={cn(
                        '-mb-px flex min-h-12 items-center border-b-2 px-3 text-sm font-semibold',
                        active ? 'border-primary text-primary' : 'border-transparent text-text-muted hover:text-text',
                      )}
                    >
                      {link.label}
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
