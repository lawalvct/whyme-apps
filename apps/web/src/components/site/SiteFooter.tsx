'use client';

import Image from 'next/image';
import { useT } from '@/lib/i18n';

export function SiteFooter() {
  const { t } = useT('market');
  return (
    <footer className="mt-16 border-t border-border bg-surface">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-10 md:flex-row md:justify-between">
        <div className="max-w-sm">
          <Image src="/brand/whyme-logo-full.png" alt="WHY ME" width={120} height={28} />
          <p className="mt-3 text-sm text-text-muted">{t('footerTagline')}</p>
        </div>
        <div id="marketplace-safety" className="max-w-sm scroll-mt-6 text-sm text-text">
          <p className="font-semibold">{t('safetyTitle')}</p>
          <p className="mt-1 text-text-muted">{t('safetyBody')}</p>
        </div>
      </div>
      <p className="border-t border-border py-4 text-center text-xs text-text-muted">© WHY ME · Delta State, Nigeria</p>
    </footer>
  );
}
