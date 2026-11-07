'use client';

import { ButtonLink } from '@/components/ui/button';
import { useT } from '@/lib/i18n';

export default function NotFound() {
  const { t } = useT('market');
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-4 py-16 text-center">
      <h1 className="text-2xl font-bold">{t('notFoundTitle')}</h1>
      <p className="text-text-muted">{t('notFoundBody')}</p>
      <ButtonLink href="/">{t('goHome')}</ButtonLink>
    </div>
  );
}
