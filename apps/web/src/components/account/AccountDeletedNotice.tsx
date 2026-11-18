'use client';

import { ButtonLink } from '@/components/ui/button';
import { routes } from '@/lib/format';
import { useT } from '@/lib/i18n';

export function AccountDeletedNotice() {
  const { t } = useT('settings');
  return (
    <section className="mx-auto flex w-full max-w-xl flex-col gap-3 py-10 text-center">
      <h1 className="text-2xl font-bold">{t('deletion.doneTitle')}</h1>
      <p className="text-text-muted">{t('deletion.doneBody')}</p>
      <div>
        <ButtonLink href={routes.home}>{t('deletion.doneHome')}</ButtonLink>
      </div>
    </section>
  );
}
