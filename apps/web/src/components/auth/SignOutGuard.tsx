'use client';

import { useCallback, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { useT } from '@/lib/i18n';
import { accountRuntime, unsentCount } from '@/lib/offline';

/**
 * Before signing out: if this browser still has changes the server hasn't confirmed, ask
 * first (ACC05): send them now, stay signed in, or discard them and sign out. Signing out
 * deletes this account's data from the browser, so unsent work would be lost.
 */
export function useSignOutGuard() {
  const { t } = useT('auth');
  const [pending, setPending] = useState<{ count: number } | null>(null);
  const [sending, setSending] = useState(false);
  const [stillUnsent, setStillUnsent] = useState(false);
  const resolver = useRef<((ok: boolean) => void) | null>(null);

  const confirm = useCallback(async (): Promise<boolean> => {
    const count = await unsentCount();
    if (count === 0) return true;
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve;
      setStillUnsent(false);
      setPending({ count });
    });
  }, []);

  function close(ok: boolean) {
    resolver.current?.(ok);
    resolver.current = null;
    setPending(null);
  }

  async function sendNow() {
    setSending(true);
    try {
      await accountRuntime()?.controller.run();
    } finally {
      setSending(false);
    }
    const left = await unsentCount();
    if (left === 0) return close(true);
    setPending({ count: left });
    setStillUnsent(true);
  }

  const dialog = pending ? (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div role="alertdialog" aria-modal="true" aria-labelledby="sign-out-title" className="flex w-full max-w-md flex-col gap-4 rounded-2xl bg-background p-5 shadow-xl">
        <h2 id="sign-out-title" className="text-lg font-bold">{t('signOutUnsentTitle')}</h2>
        <p className="text-sm">{t('signOutUnsentBody', { count: pending.count })}</p>
        {stillUnsent ? (
          <p role="alert" className="text-sm text-danger">
            {t('signOutStillUnsent')}
          </p>
        ) : null}
        <div className="flex flex-wrap gap-2">
          <Button disabled={sending} onClick={() => void sendNow()}>
            {sending ? t('common:loading') : t('syncNow')}
          </Button>
          <Button variant="secondary" disabled={sending} onClick={() => close(false)}>
            {t('staySignedIn')}
          </Button>
          <Button variant="ghost" disabled={sending} onClick={() => close(true)}>
            {t('discardAndSignOut')}
          </Button>
        </div>
      </div>
    </div>
  ) : null;

  return { confirm, dialog };
}
