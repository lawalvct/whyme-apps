'use client';

import { useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { ApiRequestError, useConfig } from '@whyme/data';
import { errorKey } from '@whyme/i18n';
import { ConfirmPhone } from '@/components/auth/ConfirmPhone';
import { useStartConversation } from '@/components/chat/useStartConversation';
import { PaymentMethods } from '@/components/payments/PaymentMethods';
import { Button, ButtonLink } from '@/components/ui/button';
import { routes } from '@/lib/format';
import { useT } from '@/lib/i18n';
import { useAccount } from '@/lib/session';

type Subject = { type: 'listing' | 'profile'; id: string };

/**
 * Message / buy / request.
 * - Guests are sent to sign in first and brought back.
 * - Signed-in users whose phone isn't confirmed yet confirm it by SMS first.
 * - "Buy with protection" opens checkout for a listing (once the owner has switched
 *   protected checkout on). Service requests arrive next, so those show a short note.
 * - "Message seller" opens the conversation.
 */
export function ContactActions({
  kind,
  subject,
  ownerId,
}: {
  kind: 'product' | 'service' | 'business' | 'provider';
  subject: Subject;
  /** The seller's user ID when the page knows it: owners see a note instead of buttons. */
  ownerId?: string;
}) {
  const { t } = useT('market');
  const { t: tChat } = useT('chat');
  const { user, status } = useAccount();
  const pathname = usePathname();
  const startConversation = useStartConversation();
  const router = useRouter();
  const checkoutOpen = useConfig().data?.features?.protected_checkout_enabled === true;
  const canBuy = kind === 'product' && subject.type === 'listing' && checkoutOpen;
  // What waits for the phone to be confirmed: the note for buy/request, or opening the chat.
  const [shown, setShown] = useState<'confirm-buy' | 'confirm-chat' | 'note' | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const primary = kind === 'product' ? t('buyNow') : kind === 'service' ? t('requestService') : null;

  if (status !== 'signed_in') {
    return (
      <div className="flex flex-col gap-2">
        {primary ? <ButtonLink href={routes.signIn(pathname)}>{primary}</ButtonLink> : null}
        {canBuy ? <PaymentMethods /> : null}
        <ButtonLink href={routes.signIn(pathname)} variant="secondary">
          {t('messageSeller')}
        </ButtonLink>
      </div>
    );
  }

  if (ownerId && user?.id === ownerId) {
    return <p className="rounded-lg bg-surface p-3 text-sm text-text-muted">{tChat('yourOwn')}</p>;
  }

  async function openChat() {
    setError(null);
    setBusy(true);
    try {
      await startConversation(subject);
    } catch (e) {
      setError(t(errorKey(e instanceof ApiRequestError ? e.code : 'network_error')));
      setBusy(false);
    }
  }

  const confirmed = Boolean(user?.phone_verified_at);

  /** After the phone is confirmed: checkout for a product, or the "coming soon" note. */
  function buy() {
    if (canBuy) router.push(routes.checkout(subject.id));
    else setShown('note');
  }

  return (
    <div className="flex flex-col gap-2">
      {primary ? <Button onClick={() => (confirmed ? buy() : setShown('confirm-buy'))}>{primary}</Button> : null}
      {canBuy ? <PaymentMethods /> : null}
      <Button variant="secondary" disabled={busy} onClick={() => (confirmed ? void openChat() : setShown('confirm-chat'))}>
        {busy ? t('common:loading') : t('messageSeller')}
      </Button>
      {shown === 'confirm-buy' ? <ConfirmPhone reason="buy" onConfirmed={buy} /> : null}
      {shown === 'confirm-chat' ? (
        <ConfirmPhone
          reason="buy"
          onConfirmed={() => {
            setShown(null);
            void openChat();
          }}
        />
      ) : null}
      {shown === 'note' ? (
        <p role="status" className="text-sm text-text-muted">
          {kind === 'product' ? t('orders:unavailable') : t('requestsSoon')}
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}
