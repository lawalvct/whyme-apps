'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { z } from 'zod';
import { applyServerErrors, ApiRequestError, unwrap, useApi, useZodForm } from '@whyme/data';
import { errorKey } from '@whyme/i18n';
import { nameSchema, otpSchema, passwordSchema, phoneSchema } from '@whyme/schemas';
import { Button } from '@/components/ui/button';
import { TextField } from '@/components/ui/field';
import { prepareSession, webDevice } from '@/lib/api';
import { routes } from '@/lib/format';
import { useT } from '@/lib/i18n';
import { AuthCard, FormError } from './AuthCard';
import { useAuthDone, useNextParam } from './useAuthDone';

const phoneStep = z.object({ phone: phoneSchema });
const detailsStep = z.object({ name: nameSchema, password: passwordSchema, code: otpSchema });

/**
 * Sign-up in two steps (ACC02): the phone gets a 6-digit code, then name,
 * password and code create the account and sign this browser in.
 */
export function SignUpForm() {
  const { t } = useT('auth');
  const next = useNextParam();
  const [phone, setPhone] = useState<string | null>(null);

  return (
    <AuthCard
      title={t('signUpTitle')}
      intro={t('signUpIntro')}
      footer={
        <>
          {t('haveAccount')}{' '}
          <Link href={routes.signIn(next)} className="font-semibold text-primary hover:underline">
            {t('signIn')}
          </Link>
        </>
      }
    >
      {phone ? <DetailsStep phone={phone} onChangePhone={() => setPhone(null)} /> : <PhoneStep onSent={setPhone} />}
    </AuthCard>
  );
}

function useSendCode() {
  const api = useApi();
  return async (phone: string) => {
    const body = unwrap(await api.POST('/v1/auth/otp', { body: { phone, purpose: 'register' } }));
    return Number(body.data.resend_in) || 60;
  };
}

function useErrorText() {
  const { t } = useT('auth');
  return (e: unknown) => t(errorKey(e instanceof ApiRequestError ? e.code : 'network_error'));
}

function PhoneStep({ onSent }: { onSent: (phone: string) => void }) {
  const { t } = useT('auth');
  const sendCode = useSendCode();
  const errorText = useErrorText();
  const [error, setError] = useState<string | null>(null);
  const form = useZodForm(phoneStep, { defaultValues: { phone: '' } });
  const { errors, isSubmitting } = form.formState;

  const onSubmit = form.handleSubmit(async ({ phone }) => {
    setError(null);
    try {
      await sendCode(phone);
      onSent(phone);
    } catch (e) {
      if (!applyServerErrors(form, e)) setError(errorText(e));
    }
  });

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      <FormError message={error} />
      <TextField
        label={t('phone')}
        hint={t('phonePrivate')}
        type="tel"
        inputMode="tel"
        autoComplete="tel"
        autoFocus
        error={errors.phone?.message ? t(errors.phone.message) : undefined}
        {...form.register('phone')}
      />
      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? t('common:loading') : t('sendCode')}
      </Button>
    </form>
  );
}

function DetailsStep({ phone, onChangePhone }: { phone: string; onChangePhone: () => void }) {
  const { t } = useT('auth');
  const api = useApi();
  const done = useAuthDone();
  const sendCode = useSendCode();
  const errorText = useErrorText();
  const [error, setError] = useState<string | null>(null);
  const [wait, setWait] = useState(60);
  const form = useZodForm(detailsStep, { defaultValues: { name: '', password: '', code: '' } });
  const { errors, isSubmitting } = form.formState;

  useEffect(() => {
    if (wait <= 0) return;
    const timer = setTimeout(() => setWait((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [wait]);

  const onSubmit = form.handleSubmit(async (values) => {
    setError(null);
    try {
      await prepareSession();
      const body = unwrap(await api.POST('/v1/auth/register', { body: { ...values, phone, device: webDevice() } }));
      done(body.data.user);
    } catch (e) {
      if (!applyServerErrors(form, e)) setError(errorText(e));
    }
  });

  async function resend() {
    setError(null);
    try {
      setWait(await sendCode(phone));
    } catch (e) {
      setError(errorText(e));
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      <p className="text-sm">
        {t('codeSent', { phone })}{' '}
        <button type="button" onClick={onChangePhone} className="font-semibold text-primary hover:underline">
          {t('changePhone')}
        </button>
      </p>
      <FormError message={error} />
      <TextField
        label={t('code')}
        inputMode="numeric"
        autoComplete="one-time-code"
        maxLength={6}
        autoFocus
        error={errors.code?.message ? t(errors.code.message) : undefined}
        {...form.register('code')}
      />
      <TextField
        label={t('name')}
        autoComplete="name"
        error={errors.name?.message ? t(errors.name.message) : undefined}
        {...form.register('name')}
      />
      <TextField
        label={t('password')}
        hint={t('passwordHint')}
        type="password"
        autoComplete="new-password"
        error={errors.password?.message ? t(errors.password.message) : undefined}
        {...form.register('password')}
      />
      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? t('common:loading') : t('signUp')}
      </Button>
      <button
        type="button"
        onClick={() => void resend()}
        disabled={wait > 0}
        className="text-sm font-semibold text-primary hover:underline disabled:text-text-muted disabled:no-underline"
      >
        {wait > 0 ? t('resendIn', { seconds: wait }) : t('resend')}
      </button>
    </form>
  );
}
