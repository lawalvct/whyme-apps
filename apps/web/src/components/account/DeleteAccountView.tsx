'use client';

import Link from 'next/link';
import { useState } from 'react';
import { z } from 'zod';
import { useQuery } from '@tanstack/react-query';
import { applyServerErrors, ApiRequestError, unwrap, useApi, useZodForm } from '@whyme/data';
import { errorKey } from '@whyme/i18n';
import { FormError } from '@/components/auth/AuthCard';
import { PasswordField } from '@/components/auth/PasswordField';
import { Button, ButtonLink } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { routes } from '@/lib/format';
import { translateFieldError, useT } from '@/lib/i18n';
import { forgetAccountOnThisDevice } from '@/lib/offline';

const REMOVED = ['details', 'listings', 'jobs', 'bank'] as const;
const KEPT = ['money', 'chats', 'records'] as const;

/** Where to finish each kind of open item before the account can go. */
const BLOCKER_LINKS: Record<string, { href: string; label: string }> = {
  orders_open: { href: routes.orders(), label: 'deletion.openOrders' },
  disputes_open: { href: routes.orders(), label: 'deletion.openOrders' },
  requests_open: { href: routes.requests(), label: 'deletion.openRequests' },
  payouts_open: { href: routes.sellPayouts, label: 'deletion.openPayouts' },
};

const schema = z.object({
  password: z.string().min(1, 'errors:validation_failed'),
  understand: z.boolean().refine((v) => v, { message: 'settings:deletion.understandRequired' }),
});

/**
 * Deleting the account (ACC05, NFR05, AT58; app store requirement). Says what is deleted and
 * what is kept, checks first that no money or work is still open, then asks for the password
 * and a tick. Afterwards this browser forgets the account and shows a confirmation page.
 */
export function DeleteAccountView() {
  const { t } = useT('settings');
  const api = useApi();
  const [error, setError] = useState<string | null>(null);
  // Set once the account is gone: keeps the button disabled while the page changes.
  const [leaving, setLeaving] = useState(false);
  const check = useQuery({
    queryKey: ['me', 'deletion'],
    queryFn: async () => unwrap(await api.GET('/v1/me/deletion')).data,
  });
  const form = useZodForm(schema, { defaultValues: { password: '', understand: false } });
  const { errors, isSubmitting } = form.formState;
  const fieldError = (message?: string) => translateFieldError(t, message);
  const blockers = Object.entries((check.data?.blockers ?? {}) as Record<string, number>).filter(([, count]) => count > 0);

  const onSubmit = form.handleSubmit(async (values) => {
    setError(null);
    try {
      const { error: failure, response } = await api.POST('/v1/me/deletion', { body: { password: values.password } });
      if (!response.ok) throw new ApiRequestError(response.status, (failure as never) ?? null);
      setLeaving(true);
      await forgetAccountOnThisDevice();
      // A full load drops everything the account had in memory.
      window.location.assign(routes.accountDeleted);
    } catch (e) {
      if (e instanceof ApiRequestError && e.code === 'account_deletion_blocked') {
        await check.refetch();
      }
      if (!applyServerErrors(form, e)) {
        setError(t(errorKey(e instanceof ApiRequestError ? e.code : 'network_error')));
      }
    }
  });

  const busy = isSubmitting || leaving;

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-5">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold">{t('deletion.title')}</h1>
        <p className="text-sm text-text-muted">{t('deletion.intro')}</p>
      </header>

      <section className="grid gap-4 rounded-2xl border border-border bg-surface p-5 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <h2 className="font-bold">{t('deletion.removedTitle')}</h2>
          <ul className="list-disc space-y-1 pl-5 text-sm">
            {REMOVED.map((key) => (
              <li key={key}>{t(`deletion.removed.${key}`)}</li>
            ))}
          </ul>
        </div>
        <div className="flex flex-col gap-2">
          <h2 className="font-bold">{t('deletion.keptTitle')}</h2>
          <ul className="list-disc space-y-1 pl-5 text-sm">
            {KEPT.map((key) => (
              <li key={key}>{t(`deletion.kept.${key}`)}</li>
            ))}
          </ul>
          <Link href={routes.privacy} className="text-sm font-semibold text-primary hover:underline">
            {t('deletion.keptMore')}
          </Link>
        </div>
      </section>

      {check.isPending ? (
        <>
          <p className="sr-only" role="status">{t('deletion.checking')}</p>
          <Skeleton className="h-40 w-full" />
        </>
      ) : check.isError ? (
        <FormError message={t(errorKey(check.error instanceof ApiRequestError ? check.error.code : 'network_error'))} />
      ) : blockers.length > 0 ? (
        <section role="alert" className="flex flex-col gap-3 rounded-2xl border border-accent/50 bg-accent-soft p-5">
          <h2 className="font-bold">{t('deletion.blockedTitle')}</h2>
          <p className="text-sm">{t('deletion.blockedIntro')}</p>
          <ul className="flex flex-col gap-2 text-sm">
            {blockers.map(([code, count]) => (
              <li key={code} className="flex flex-wrap items-center gap-x-3">
                <span>{t(`deletion.blockers.${code}`, { count })}</span>
                {BLOCKER_LINKS[code] ? (
                  <Link href={BLOCKER_LINKS[code].href} className="font-semibold text-primary hover:underline">
                    {t(BLOCKER_LINKS[code].label)}
                  </Link>
                ) : null}
              </li>
            ))}
          </ul>
          <p className="text-sm text-text-muted">{t('deletion.stuck')}</p>
          <div>
            <ButtonLink href={routes.account} variant="secondary">{t('deletion.cancel')}</ButtonLink>
          </div>
        </section>
      ) : (
        <form method="post" onSubmit={onSubmit} noValidate className="flex flex-col gap-4 rounded-2xl border border-danger/40 bg-surface p-5">
          <FormError message={error} />
          <PasswordField
            label={t('deletion.password')}
            hint={t('deletion.passwordHint')}
            autoComplete="current-password"
            error={fieldError(errors.password?.message)}
            {...form.register('password')}
          />
          <div className="flex flex-col gap-1">
            <label className="flex min-h-11 cursor-pointer items-start gap-3 text-sm">
              <input type="checkbox" className="mt-0.5 size-5 shrink-0 accent-danger" {...form.register('understand')} />
              <span>{t('deletion.understand')}</span>
            </label>
            {errors.understand?.message ? (
              <p role="alert" className="text-sm text-danger">{fieldError(errors.understand.message)}</p>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-3">
            <Button type="submit" variant="danger" disabled={busy}>
              {busy ? t('deletion.deleting') : t('deletion.confirm')}
            </Button>
            <ButtonLink href={routes.account} variant="ghost" aria-disabled={busy}>
              {t('deletion.cancel')}
            </ButtonLink>
          </div>
        </form>
      )}
    </div>
  );
}
