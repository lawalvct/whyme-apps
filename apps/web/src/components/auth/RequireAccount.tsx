'use client';

import { useRouter } from 'next/navigation';
import { useEffect, type ReactNode } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { routes } from '@/lib/format';
import { useT } from '@/lib/i18n';
import { useAccount } from '@/lib/session';
import { PhoneConfirmed } from './ConfirmPhone';

/**
 * Private pages (messages, orders, requests, the seller centre, CVs and job
 * applications): signed-out visitors go to sign-in and come back here. With `phone`, an account whose phone isn't confirmed yet
 * confirms it by SMS first (the API requires it for these actions).
 */
export function RequireAccount({ children, phone }: { children: ReactNode; phone?: 'seller' | 'buy' | 'jobs' }) {
  const { t } = useT('seller');
  const { status } = useAccount();
  const router = useRouter();

  useEffect(() => {
    if (status === 'signed_out') router.replace(routes.signIn(window.location.pathname + window.location.search));
  }, [status, router]);

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

  return phone ? <PhoneConfirmed reason={phone}>{children}</PhoneConfirmed> : children;
}
