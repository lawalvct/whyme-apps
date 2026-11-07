'use client';

import { useState } from 'react';
import { usePathname } from 'next/navigation';
import { Button, ButtonLink } from '@/components/ui/button';
import { routes } from '@/lib/format';
import { useT } from '@/lib/i18n';
import { useAccount } from '@/lib/session';

/**
 * Message / buy / request. Guests are sent to sign in first and brought back.
 * Chat and protected checkout arrive in later phases, so signed-in users get a
 * short note for now.
 */
export function ContactActions({ kind }: { kind: 'product' | 'service' | 'business' | 'provider' }) {
  const { t } = useT('market');
  const { status } = useAccount();
  const pathname = usePathname();
  const [note, setNote] = useState(false);

  const primary = kind === 'product' ? t('buyNow') : kind === 'service' ? t('requestService') : null;

  if (status !== 'signed_in') {
    return (
      <div className="flex flex-col gap-2">
        {primary ? <ButtonLink href={routes.signIn(pathname)}>{primary}</ButtonLink> : null}
        <ButtonLink href={routes.signIn(pathname)} variant="secondary">
          {t('messageSeller')}
        </ButtonLink>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {primary ? <Button onClick={() => setNote(true)}>{primary}</Button> : null}
      <Button variant="secondary" onClick={() => setNote(true)}>
        {t('messageSeller')}
      </Button>
      {note ? (
        <p role="status" className="text-sm text-text-muted">
          {t('comingSoon')}
        </p>
      ) : null}
    </div>
  );
}
