'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { z } from 'zod';
import { useQueryClient } from '@tanstack/react-query';
import { ApiRequestError, applyServerErrors, queryKeys, unwrap, useApi, useZodForm, type Me } from '@whyme/data';
import { errorKey } from '@whyme/i18n';
import { otpSchema } from '@whyme/schemas';
import { Button } from '@/components/ui/button';
import { cn } from '@/components/ui/cn';
import { TextField } from '@/components/ui/field';
import { useT } from '@/lib/i18n';
import { useAccount } from '@/lib/session';
import { FormError } from './AuthCard';

type Reason = 'seller' | 'buy';

const schema = z.object({ code: otpSchema });

/**
 * Critical actions need a phone number confirmed by SMS. Accounts that signed
 * up with a code by email see this first (the API answers `phone_unverified`
 * otherwise). Signed-in users with a confirmed phone see the children.
 */
export function PhoneConfirmed({ reason, children }: { reason: Reason; children: ReactNode }) {
  const { user } = useAccount();
  if (user && !user.phone_verified_at) {
    return <ConfirmPhone reason={reason} className="mx-auto w-full max-w-md" />;
  }
  return children;
}

/** Text a code to the account's phone, then confirm it. Updates the signed-in account when done. */
export function ConfirmPhone({ reason, onConfirmed, className }: { reason: Reason; onConfirmed?: () => void; className?: string }) {
  const { t } = useT('auth');
  const api = useApi();
  const queryClient = useQueryClient();
  const { user } = useAccount();
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);
  const [wait, setWait] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const form = useZodForm(schema, { defaultValues: { code: '' } });
  const { errors, isSubmitting } = form.formState;
  const errorText = (e: unknown) => t(errorKey(e instanceof ApiRequestError ? e.code : 'network_error'));

  useEffect(() => {
    if (wait <= 0) return;
    const timer = setTimeout(() => setWait((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [wait]);

  function confirmed(account?: Me) {
    if (account) queryClient.setQueryData(queryKeys.me, account);
    else void queryClient.invalidateQueries({ queryKey: queryKeys.me });
    onConfirmed?.();
  }

  async function sendCode() {
    setError(null);
    setSending(true);
    try {
      const body = unwrap(await api.POST('/v1/me/phone/code'));
      setSent(true);
      setWait(Number(body.data.resend_in) || 60);
    } catch (e) {
      // Confirmed on another device meanwhile: nothing left to do.
      if (e instanceof ApiRequestError && e.code === 'phone_already_verified') return confirmed();
      setError(errorText(e));
    } finally {
      setSending(false);
    }
  }

  const onSubmit = form.handleSubmit(async ({ code }) => {
    setError(null);
    try {
      confirmed(unwrap(await api.POST('/v1/me/phone/verify', { body: { code } })).data);
    } catch (e) {
      if (e instanceof ApiRequestError && e.code === 'phone_already_verified') return confirmed();
      if (!applyServerErrors(form, e)) setError(errorText(e));
    }
  });

  const phone = user?.phone ?? '';

  return (
    <section className={cn('flex flex-col gap-4 rounded-2xl border border-border p-5', className)} aria-labelledby="confirm-phone-title">
      <div>
        <h2 id="confirm-phone-title" className="text-lg font-bold">
          {t('confirmPhoneTitle')}
        </h2>
        <p className="mt-1 text-sm text-text-muted">{reason === 'seller' ? t('confirmPhoneSeller') : t('confirmPhoneBuy')}</p>
      </div>

      <FormError message={error} />

      {sent ? (
        <form method="post" onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
          <p className="text-sm">{t('codeSent', { phone })}</p>
          <TextField
            label={t('code')}
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            autoFocus
            error={errors.code?.message ? t(errors.code.message) : undefined}
            {...form.register('code')}
          />
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? t('common:loading') : t('confirmCode')}
          </Button>
          <button
            type="button"
            onClick={() => void sendCode()}
            disabled={wait > 0 || sending}
            className="text-sm font-semibold text-primary hover:underline disabled:text-text-muted disabled:no-underline"
          >
            {wait > 0 ? t('resendIn', { seconds: wait }) : t('resend')}
          </button>
        </form>
      ) : (
        <>
          <p className="text-sm">{t('confirmPhoneSendTo', { phone })}</p>
          <Button onClick={() => void sendCode()} disabled={sending}>
            {sending ? t('common:loading') : t('textMeCode')}
          </Button>
        </>
      )}
    </section>
  );
}
