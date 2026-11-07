'use client';

import { useT } from '@/lib/i18n';

export function SkipLink() {
  const { t } = useT('market');
  return (
    <a href="#content" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-background focus:p-3">
      {t('skipToContent')}
    </a>
  );
}
