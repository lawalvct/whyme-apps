'use client';

import Link from 'next/link';
import { buttonClass } from '@/components/ui/button';
import { routes } from '@/lib/format';
import { useT } from '@/lib/i18n';

/** What the service worker shows for a page that was never opened on this device. Its links are plain navigations, so they work without the page's code. */
export function OfflinePage() {
  const { t } = useT('sync');

  return (
    <div className="mx-auto flex max-w-lg flex-col items-center gap-4 py-16 text-center">
      <h1 className="text-2xl font-bold">{t('offlineTitle')}</h1>
      <p className="text-text-muted">{t('offlineBody')}</p>
      {/* A plain link to this same address: works even if the page's code didn't load. */}
      <a href="" className={buttonClass('primary')}>
        {t('offlineRetry')}
      </a>
      <nav className="flex flex-wrap justify-center gap-4 text-sm font-semibold text-primary">
        <Link href={routes.saved} className="hover:underline">{t('offlineSaved')}</Link>
        <Link href={routes.orders()} className="hover:underline">{t('offlineOrders')}</Link>
        <Link href={routes.messages} className="hover:underline">{t('offlineMessages')}</Link>
        <Link href={routes.home} className="hover:underline">{t('offlineHome')}</Link>
      </nav>
    </div>
  );
}
