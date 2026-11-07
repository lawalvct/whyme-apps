'use client';

import Link from 'next/link';
import { useState } from 'react';
import { z } from 'zod';
import { applyServerErrors, ApiRequestError, unwrap, useApi, useZodForm } from '@whyme/data';
import { errorKey } from '@whyme/i18n';
import { loginSchema, otpSchema } from '@whyme/schemas';
import { Button } from '@/components/ui/button';
import { TextField } from '@/components/ui/field';
import { prepareSession, webDevice } from '@/lib/api';
import { routes } from '@/lib/format';
import { useT } from '@/lib/i18n';
import { AuthCard, FormError } from './AuthCard';
import { useAuthDone, useNextParam } from './useAuthDone';

const schema = loginSchema.extend({ code: otpSchema.or(z.literal('')).optional() });

/**
 * Phone + password with Sanctum's cookie session. A browser the account hasn't
 * used before also needs the SMS code the API sends (docs/01 §11).
 */
export function SignInForm() {
  const { t } = useT('auth');
  const api = useApi();
  const done = useAuthDone();
  const next = useNextParam();
  const [needsCode, setNeedsCode] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const form = useZodForm(schema, { defaultValues: { phone: '', password: '', code: '' } });
  const { errors, isSubmitting } = form.formState;

  const onSubmit = form.handleSubmit(async (values) => {
    setError(null);
    try {
      await prepareSession();
      const body = unwrap(
        await api.POST('/v1/auth/login', {
          body: { phone: values.phone, password: values.password, code: needsCode ? values.code || null : null, device: webDevice() },
        }),
      );
      if ('otp_required' in body.data) {
        setNeedsCode(true);
        return;
      }
      done(body.data.user);
    } catch (e) {
      if (!applyServerErrors(form, e)) {
        setError(t(errorKey(e instanceof ApiRequestError ? e.code : 'network_error')));
      }
    }
  });

  return (
    <AuthCard
      title={t('signInTitle')}
      intro={t('signInIntro')}
      footer={
        <>
          {t('noAccount')}{' '}
          <Link href={routes.signUp(next)} className="font-semibold text-primary hover:underline">
            {t('signUp')}
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
        <FormError message={error} />
        <TextField
          label={t('phone')}
          hint={t('phoneHint')}
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          error={errors.phone?.message ? t(errors.phone.message) : undefined}
          {...form.register('phone')}
        />
        <TextField
          label={t('password')}
          type="password"
          autoComplete="current-password"
          error={errors.password?.message ? t(errors.password.message) : undefined}
          {...form.register('password')}
        />
        {needsCode ? (
          <TextField
            label={t('code')}
            hint={t('newDeviceCode')}
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            autoFocus
            error={errors.code?.message ? t(errors.code.message) : undefined}
            {...form.register('code')}
          />
        ) : null}
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? t('common:loading') : t('signIn')}
        </Button>
      </form>
    </AuthCard>
  );
}
