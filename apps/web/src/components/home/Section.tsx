'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { useT } from '@/lib/i18n';

/** A titled home-page section with a "See all" link. Hidden when it has nothing to show. */
export function Section({ titleKey, href, empty, children }: { titleKey: string; href: string; empty: boolean; children: ReactNode }) {
  const { t } = useT('market');
  if (empty) return null;
  return (
    <section className="mt-10">
      <div className="mb-4 flex items-baseline justify-between gap-4">
        <h2 className="text-xl font-bold text-text">{t(titleKey)}</h2>
        <Link href={href} className="text-sm font-semibold text-primary hover:underline">
          {t('seeAll')}
        </Link>
      </div>
      {children}
    </section>
  );
}
