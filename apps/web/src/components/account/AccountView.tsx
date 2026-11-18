'use client';

import Link from 'next/link';
import { useEffect, useState, type ReactNode } from 'react';
import { z } from 'zod';
import { useQueryClient } from '@tanstack/react-query';
import { applyServerErrors, ApiRequestError, queryKeys, unwrap, useApi, useZodForm, type Me } from '@whyme/data';
import { errorKey, isSupportedLanguage } from '@whyme/i18n';
import { passwordSchema, personNameSchema } from '@whyme/schemas';
import { FormError } from '@/components/auth/AuthCard';
import { PasswordField } from '@/components/auth/PasswordField';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { Badge } from '@/components/ui/badge';
import { Button, ButtonLink } from '@/components/ui/button';
import { TextField } from '@/components/ui/field';
import { routes } from '@/lib/format';
import { translateFieldError, useLanguage, useT } from '@/lib/i18n';
import { useAccount } from '@/lib/session';

/**
 * The signed-in person's account (ACC03, ACC05): their name and language, phone and email,
 * password, the terms and Privacy Policy, and deleting the account.
 */
export function AccountView() {
  const { t } = useT('settings');
  const { user } = useAccount();
  if (!user) return null;

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-5">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold">{t('account.title')}</h1>
        <p className="text-sm text-text-muted">{t('account.intro')}</p>
      </header>

      <Section title={t('account.detailsTitle')} hint={t('account.detailsHint')}>
        <DetailsForm user={user} />
        <LanguagePreference user={user} />
      </Section>

      <Section title={t('account.signInTitle')}>
        <dl className="grid gap-3 text-sm sm:grid-cols-[10rem_1fr]">
          <dt className="font-medium text-text-muted">{t('account.phone')}</dt>
          <dd className="flex flex-wrap items-center gap-2">
            <span>{user.phone}</span>
            <Badge tone={user.phone_verified_at ? 'primary' : 'warning'}>{t(user.phone_verified_at ? 'account.confirmed' : 'account.notConfirmed')}</Badge>
            <span className="w-full text-text-muted">{t('account.phonePrivate')}</span>
          </dd>
          <dt className="font-medium text-text-muted">{t('account.email')}</dt>
          <dd className="flex flex-wrap items-center gap-2">
            {user.email ? (
              <>
                <span>{user.email}</span>
                <Badge tone={user.email_verified_at ? 'primary' : 'warning'}>{t(user.email_verified_at ? 'account.confirmed' : 'account.notConfirmed')}</Badge>
              </>
            ) : (
              <span className="text-text-muted">{t('account.noEmail')}</span>
            )}
          </dd>
        </dl>
      </Section>

      <Section title={t('account.passwordTitle')}>
        <PasswordForm />
      </Section>

      <Section title={t('account.legalTitle')}>
        <ul className="flex flex-wrap gap-x-5 gap-y-2 text-sm font-semibold text-primary">
          <li><Link href={routes.terms('platform')} className="hover:underline">{t('common:termsPlatform')}</Link></li>
          <li><Link href={routes.terms('buyer')} className="hover:underline">{t('common:termsBuyer')}</Link></li>
          <li><Link href={routes.terms('seller')} className="hover:underline">{t('common:termsSeller')}</Link></li>
          <li><Link href={routes.privacy} className="hover:underline">{t('account.privacyPolicy')}</Link></li>
        </ul>
      </Section>

      <Section title={t('account.deleteTitle')} hint={t('account.deleteHint')} danger>
        <div>
          <ButtonLink href={routes.accountDelete} variant="secondary" className="text-danger hover:border-danger hover:text-danger">
            {t('account.deleteOpen')}
          </ButtonLink>
        </div>
      </Section>
    </div>
  );
}

function Section({ title, hint, danger, children }: { title: string; hint?: string; danger?: boolean; children: ReactNode }) {
  return (
    <section className={`flex flex-col gap-4 rounded-2xl border bg-surface p-5 ${danger ? 'border-danger/40' : 'border-border'}`}>
      <div className="flex flex-col gap-1">
        <h2 className="text-lg font-bold">{title}</h2>
        {hint ? <p className="text-sm text-text-muted">{hint}</p> : null}
      </div>
      {children}
    </section>
  );
}

const detailsSchema = z.object({ first_name: personNameSchema, last_name: personNameSchema });

function DetailsForm({ user }: { user: Me }) {
  const { t } = useT('settings');
  const api = useApi();
  const queryClient = useQueryClient();
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const form = useZodForm(detailsSchema, { defaultValues: { first_name: user.first_name, last_name: user.last_name } });
  const { errors, isSubmitting, isDirty } = form.formState;
  const fieldError = (message?: string) => translateFieldError(t, message);

  const onSubmit = form.handleSubmit(async (values) => {
    setNotice(null);
    setError(null);
    try {
      const body = unwrap(await api.PATCH('/v1/me', { body: { ...values, version: user.version } }));
      queryClient.setQueryData(queryKeys.me, body.data);
      form.reset({ first_name: body.data.first_name, last_name: body.data.last_name });
      setNotice(t('account.saved'));
    } catch (e) {
      if (e instanceof ApiRequestError && e.code === 'conflict') {
        await queryClient.invalidateQueries({ queryKey: queryKeys.me });
        setError(t('account.changedElsewhere'));
      } else if (!applyServerErrors(form, e)) {
        setError(t(errorKey(e instanceof ApiRequestError ? e.code : 'network_error')));
      }
    }
  });

  return (
    <form method="post" onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      <FormError message={error} />
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField label={t('account.firstName')} autoComplete="given-name" error={fieldError(errors.first_name?.message)} {...form.register('first_name')} />
        <TextField label={t('account.lastName')} autoComplete="family-name" error={fieldError(errors.last_name?.message)} {...form.register('last_name')} />
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={isSubmitting || !isDirty}>
          {isSubmitting ? t('account.saving') : t('account.save')}
        </Button>
        {notice ? <p role="status" className="text-sm font-semibold text-success">{notice}</p> : null}
      </div>
    </form>
  );
}

/** The language buttons change the site at once; the choice is also saved on the account. */
function LanguagePreference({ user }: { user: Me }) {
  const api = useApi();
  const queryClient = useQueryClient();
  const language = useLanguage();

  useEffect(() => {
    if (!isSupportedLanguage(language) || language === user.locale) return;
    let cancelled = false;
    void api
      .PATCH('/v1/me', { body: { locale: language, version: user.version } })
      .then((r) => unwrap(r))
      .then((body) => {
        if (!cancelled) queryClient.setQueryData(queryKeys.me, body.data);
      })
      .catch(() => {
        // Saved on this device either way; the account copy catches up next time.
      });
    return () => {
      cancelled = true;
    };
  }, [api, language, queryClient, user.locale, user.version]);

  return <LanguageSwitcher />;
}

const passwordFormSchema = z.object({ current_password: z.string().min(1, 'errors:validation_failed'), password: passwordSchema });

function PasswordForm() {
  const { t } = useT('settings');
  const api = useApi();
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const form = useZodForm(passwordFormSchema, { defaultValues: { current_password: '', password: '' } });
  const { errors, isSubmitting } = form.formState;
  const fieldError = (message?: string) => translateFieldError(t, message);

  const onSubmit = form.handleSubmit(async (values) => {
    setNotice(null);
    setError(null);
    try {
      const { error: failure, response } = await api.POST('/v1/me/password', { body: values });
      if (!response.ok) throw new ApiRequestError(response.status, (failure as never) ?? null);
      form.reset({ current_password: '', password: '' });
      setNotice(t('account.passwordChanged'));
    } catch (e) {
      if (!applyServerErrors(form, e)) {
        setError(t(errorKey(e instanceof ApiRequestError ? e.code : 'network_error')));
      }
    }
  });

  return (
    <form method="post" onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      <FormError message={error} />
      <div className="grid gap-4 sm:grid-cols-2">
        <PasswordField label={t('account.currentPassword')} autoComplete="current-password" error={fieldError(errors.current_password?.message)} {...form.register('current_password')} />
        <PasswordField label={t('account.newPassword')} hint={t('account.newPasswordHint')} autoComplete="new-password" error={fieldError(errors.password?.message)} {...form.register('password')} />
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? t('account.changingPassword') : t('account.changePassword')}
        </Button>
        {notice ? <p role="status" className="text-sm font-semibold text-success">{notice}</p> : null}
      </div>
    </form>
  );
}
