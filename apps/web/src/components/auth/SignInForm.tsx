'use client';

import Link from 'next/link';
import { useState } from 'react';
import { z } from 'zod';
import { applyServerErrors, ApiRequestError, unwrap, useApi, useZodForm } from '@whyme/data';
import { errorKey } from '@whyme/i18n';
import { loginSchema, otpSchema } from '@whyme/schemas';
import { Button } from '@/components/ui/button';
import { TextField } from '@/components/ui/field';
import { MarketplaceIcon as Icon } from '@/components/ui/MarketplaceIcon';
import { prepareSession, webDevice } from '@/lib/api';
import { routes } from '@/lib/format';
import { useT } from '@/lib/i18n';
import { AuthCard, FormError } from './AuthCard';
import { useAuthDone, useNextParam } from './useAuthDone';
import { PasswordField } from './PasswordField';
import styles from './AuthCard.module.css';

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
  // Where the new-device code went: by SMS, or to the email of an account confirmed by email.
  const [needsCode, setNeedsCode] = useState<{ channel: string; sentTo: string } | null>(null);
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
        setNeedsCode({ channel: String(body.data.channel), sentTo: body.data.sent_to });
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
      title={t(needsCode ? 'ui.deviceTitle' : 'ui.signInTitle')}
      intro={t(needsCode ? 'ui.deviceIntro' : 'ui.signInIntro')}
      mode="signin"
      next={next}
      footer={
        <>
          {t('noAccount')}{' '}
          <Link href={routes.signUp(next)} className="font-semibold text-primary hover:underline">
            {t('signUp')}
          </Link>
        </>
      }
    >
      <form method="post" onSubmit={onSubmit} noValidate className={styles.form}>
        <FormError message={error} />
        <TextField
          label={t('phone')}
          hint={t('ui.signInPhoneHint')}
          placeholder="0803 123 4567"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          error={errors.phone?.message ? t(errors.phone.message) : undefined}
          {...form.register('phone')}
        />
        <PasswordField
          label={t('password')}
          autoComplete="current-password"
          error={errors.password?.message ? t(errors.password.message) : undefined}
          {...form.register('password')}
        />
        {needsCode ? (
          <TextField
            className={styles.codeField}
            label={t('code')}
            hint={needsCode.channel === 'email' ? t('newDeviceCodeEmail', { email: needsCode.sentTo }) : t('newDeviceCode')}
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            autoFocus
            error={errors.code?.message ? t(errors.code.message) : undefined}
            {...form.register('code')}
          />
        ) : null}
        <Button type="submit" disabled={isSubmitting} className={styles.primaryButton}>
          {isSubmitting ? t('common:loading') : t('signIn')}
          <Icon name="arrow" />
        </Button>
      </form>
    </AuthCard>
  );
}
