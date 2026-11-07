'use client';

import { Button } from '@/components/ui/button';
import { useT } from '@/lib/i18n';

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const { t } = useT('market');
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-4 py-16 text-center">
      <h1 className="text-2xl font-bold">{t('errorTitle')}</h1>
      <p className="text-text-muted">{t('errorBody')}</p>
      <Button onClick={reset}>{t('common:retry')}</Button>
    </div>
  );
}
