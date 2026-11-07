'use client';

import { useState } from 'react';
import { usePathname } from 'next/navigation';
import { ConfirmPhone } from '@/components/auth/ConfirmPhone';
import { Button, ButtonLink } from '@/components/ui/button';
import { routes } from '@/lib/format';
import { useT } from '@/lib/i18n';
import { useAccount } from '@/lib/session';

/**
 * Message / buy / request. Guests are sent to sign in first and brought back.
 * Signed-in users whose phone isn't confirmed yet confirm it by SMS first.
 * Chat and protected checkout arrive in later phases, so after that they get a
 * short note for now.
 */
export function ContactActions({ kind }: { kind: 'product' | 'service' | 'business' | 'provider' }) {
  const { t } = useT('market');
  const { user, status } = useAccount();
  const pathname = usePathname();
  const [shown, setShown] = useState<'confirm' | 'note' | null>(null);
  const act = () => setShown(user?.phone_verified_at ? 'note' : 'confirm');

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
      {primary ? <Button onClick={act}>{primary}</Button> : null}
      <Button variant="secondary" onClick={act}>
        {t('messageSeller')}
      </Button>
      {shown === 'confirm' ? <ConfirmPhone reason="buy" onConfirmed={() => setShown('note')} /> : null}
      {shown === 'note' ? (
        <p role="status" className="text-sm text-text-muted">
          {t('comingSoon')}
        </p>
      ) : null}
    </div>
  );
}
