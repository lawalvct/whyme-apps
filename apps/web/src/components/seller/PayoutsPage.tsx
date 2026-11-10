'use client';

import { useState, type FormEvent } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ApiRequestError,
  payoutKeys,
  unwrap,
  useApi,
  useBanks,
  useEarnings,
  usePayoutAccount,
  type Earnings,
  type PayoutAccount,
} from '@whyme/data';
import { errorKey } from '@whyme/i18n';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { SelectField, TextField } from '@/components/ui/field';
import { Skeleton } from '@/components/ui/skeleton';
import { MarketplaceIcon as Icon } from '@/components/ui/MarketplaceIcon';
import { formatNaira, routes } from '@/lib/format';
import { useLanguage, useT } from '@/lib/i18n';
import { Notice, PageTitle } from './common';
import styles from './SellerWorkspace.module.css';

function apiMessage(t: (key: string) => string, e: unknown): string {
  return t(errorKey(e instanceof ApiRequestError ? e.code : 'network_error'));
}

/**
 * A seller's payouts (FIN03, FIN04): what they've earned by where the money is ("eligible"
 * is not "paid"), the bank account WHY ME pays into, and the payouts so far.
 */
export function PayoutsPage() {
  const { t } = useT('seller');
  const earnings = useEarnings();

  return (
    <div className={`${styles.workspace} ${styles.controls}`}>
      <PageTitle title={t('payouts.title')} intro={t('payouts.intro')} />

      {earnings.isPending ? (
        <Skeleton className="h-32 w-full" />
      ) : earnings.isError ? (
        <p role="alert" className="rounded-lg bg-surface p-3 text-sm text-danger">
          {t('payouts.loadFailed')}
        </p>
      ) : (
        <Totals totals={earnings.data.totals} />
      )}

      <div className={styles.payoutLayout}><AccountCard /><aside className={styles.editorGuide}><Icon name="shield" /><h2>{t('workspace.payoutsGuide')}</h2><p>{t('workspace.payoutsGuideHint')}</p><Link href={routes.orders('sold')} className={styles.editorBack}>{t('workspace.viewSoldOrders')}<Icon name="arrow" /></Link></aside></div>

      {earnings.data ? <History payouts={earnings.data.payouts} /> : null}
    </div>
  );
}

function Totals({ totals }: { totals: Earnings['totals'] }) {
  const { t } = useT('seller');
  const items = [
    { key: 'awaiting_delivery', value: totals.awaiting_delivery_kobo, hint: true },
    { key: 'on_hold', value: totals.on_hold_kobo, hint: true },
    { key: 'awaiting_release', value: totals.awaiting_release_kobo, hint: true },
    { key: 'being_paid', value: totals.being_paid_kobo, hint: false },
    { key: 'paid', value: totals.paid_kobo, hint: false },
  ];

  return (
    <dl className={styles.payoutTotals}>
      {items.map((item) => (
        <div key={item.key} data-state={item.key}>
          <dt className="text-xs font-semibold text-text-muted">{t(`payouts.totals.${item.key}`)}</dt>
          <dd className="text-lg font-bold">{formatNaira(item.value)}</dd>
          {item.hint ? <dd className="text-xs text-text-muted">{t(`payouts.totals.${item.key}_hint`)}</dd> : null}
        </div>
      ))}
    </dl>
  );
}

function AccountCard() {
  const { t } = useT('seller');
  const language = useLanguage();
  const account = usePayoutAccount();
  const [editing, setEditing] = useState(false);
  const [saved, setSaved] = useState(false);

  if (account.isPending) return <Skeleton className="h-28 w-full" />;
  if (account.isError) return <div className={styles.queryError}><Notice tone="error">{t('workspace.accountLoadFailed')}</Notice><Button variant="secondary" disabled={account.isFetching} onClick={() => void account.refetch()}>{t('overview.tryAgain')}</Button></div>;
  const current = account.data ?? null;
  const format = new Intl.DateTimeFormat(language === 'ig' ? 'ig-NG' : 'en-NG', { dateStyle: 'medium', timeStyle: 'short' });

  return (
    <section className={styles.accountCard}>
      <div>
        <h2 className="font-bold">{t('payouts.account')}</h2>
        <p className="text-sm text-text-muted">{t('payouts.accountIntro')}</p>
      </div>

      {current && !editing ? (
        <div className="flex flex-col gap-1">
          <p className="font-semibold">{current.account_name}</p>
          <p className="text-sm text-text-muted">{t('payouts.endingIn', { bank: current.bank_name, last4: current.account_last4 })}</p>
          {current.payouts_allowed_from ? (
            <p className="mt-1 rounded-lg bg-accent-soft p-2 text-sm">{t('payouts.coolingOff', { date: format.format(new Date(current.payouts_allowed_from)) })}</p>
          ) : null}
          {saved ? (
            <p role="status" className="text-sm text-primary">
              {t('payouts.saved')}
            </p>
          ) : null}
        </div>
      ) : null}
      {!current && !editing ? <p className="text-sm">{t('payouts.noAccount')}</p> : null}

      {editing ? (
        <AccountForm
          current={current}
          onDone={() => {
            setEditing(false);
            setSaved(true);
          }}
          onCancel={() => setEditing(false)}
        />
      ) : (
        <Button variant={current ? 'secondary' : 'primary'} onClick={() => setEditing(true)} className="self-start">
          {current ? t('payouts.change') : t('payouts.add')}
        </Button>
      )}
    </section>
  );
}

/**
 * Bank, account number, the bank's own name for it, then a code to confirm: the account
 * can't be changed by someone who only has the password (FIN04).
 */
function AccountForm({ current, onDone, onCancel }: { current: PayoutAccount | null; onDone: () => void; onCancel: () => void }) {
  const { t } = useT('seller');
  const api = useApi();
  const queryClient = useQueryClient();
  const banks = useBanks();
  const [bank, setBank] = useState(current?.bank_code ?? '');
  const [number, setNumber] = useState('');
  const [name, setName] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<Record<string, string>>({});

  const lookup = useMutation({
    mutationFn: async () =>
      unwrap(await api.POST('/v1/me/payout-account/lookup', { body: { bank_code: bank, account_number: number } })).data.account_name,
    onSuccess: (accountName) => setName(accountName),
    onError: (e) => setError(apiMessage(t, e)),
  });
  const send = useMutation({
    mutationFn: async () => unwrap(await api.POST('/v1/me/payout-account/code')).data as { channel: string; sent_to: string },
    onSuccess: (data) => setSentTo(data.sent_to),
    onError: (e) => setError(apiMessage(t, e)),
  });
  const save = useMutation({
    mutationFn: async () =>
      unwrap(await api.PUT('/v1/me/payout-account', { body: { bank_code: bank, account_number: number, code } })).data,
    onSuccess: (account) => {
      queryClient.setQueryData(payoutKeys.account, account);
      void queryClient.invalidateQueries({ queryKey: payoutKeys.all });
      onDone();
    },
    onError: (e) => setError(apiMessage(t, e)),
  });
  const busy = lookup.isPending || send.isPending || save.isPending;

  function check(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    setError(null);
    const problems: Record<string, string> = {};
    if (!bank) problems.bank = t('payouts.chooseBank');
    if (!/^\d{10}$/.test(number)) problems.number = t('payouts.accountNumberInvalid');
    setFieldError(problems);
    if (Object.keys(problems).length === 0) lookup.mutate();
  }

  function confirm(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    setError(null);
    if (!/^\d{6}$/.test(code)) {
      setFieldError({ code: t('payouts.codeInvalid') });
      return;
    }
    setFieldError({});
    save.mutate();
  }

  // Changing the bank or number means checking the name again.
  function reset() {
    setName(null);
    setSentTo(null);
    setCode('');
  }

  return (
    <div className={styles.bankForm}>
      <form method="post" onSubmit={check} noValidate className="flex flex-col gap-3">
        <SelectField
          label={t('payouts.bank')}
          value={bank}
          onChange={(e) => {
            setBank(e.target.value);
            reset();
          }}
          error={fieldError.bank}
          disabled={banks.isPending}
        >
          <option value="">{t('payouts.chooseBank')}</option>
          {(banks.data ?? []).map((b) => (
            <option key={b.code} value={b.code}>
              {b.name}
            </option>
          ))}
        </SelectField>
        <TextField
          label={t('payouts.accountNumber')}
          value={number}
          inputMode="numeric"
          autoComplete="off"
          maxLength={10}
          onChange={(e) => {
            setNumber(e.target.value.replace(/\D/g, ''));
            reset();
          }}
          error={fieldError.number}
        />
        {name === null ? (
          <Button type="submit" variant="secondary" disabled={busy} className="self-start">
            {lookup.isPending ? t('payouts.checking') : t('payouts.lookup')}
          </Button>
        ) : null}
      </form>

      {name !== null ? (
        <div className="flex flex-col gap-3 rounded-xl bg-primary-soft/40 p-3">
          <p className="text-sm">{t('payouts.nameIs')}</p>
          <p className="text-lg font-bold">{name}</p>
          <p className="text-xs text-text-muted">{t('payouts.notYou')}</p>
          {sentTo === null ? (
            <Button disabled={busy} onClick={() => send.mutate()} className="self-start">
              {send.isPending ? t('payouts.sending') : t('payouts.sendCode')}
            </Button>
          ) : (
            <form method="post" onSubmit={confirm} noValidate className="flex flex-col gap-3">
              <p className="text-sm">{t('payouts.codeSent', { to: sentTo })}</p>
              <TextField
                label={t('payouts.code')}
                value={code}
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                error={fieldError.code}
                className="max-w-40"
              />
              <Button type="submit" disabled={busy} className="self-start">
                {save.isPending ? t('payouts.saving') : t('payouts.save')}
              </Button>
            </form>
          )}
        </div>
      ) : null}

      {error ? (
        <p role="alert" className="rounded-lg bg-surface p-3 text-sm text-danger">
          {error}
        </p>
      ) : null}
      <Button variant="ghost" disabled={busy} onClick={onCancel} className="self-start">
        {t('payouts.cancel')}
      </Button>
    </div>
  );
}

function History({ payouts }: { payouts: Earnings['payouts'] }) {
  const { t } = useT('seller');
  const language = useLanguage();
  const format = new Intl.DateTimeFormat(language === 'ig' ? 'ig-NG' : 'en-NG', { dateStyle: 'medium' });

  return (
    <section className={styles.history}>
      <h2 className="font-bold">{t('payouts.history')}</h2>
      {payouts.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-text-muted">{t('payouts.noPayouts')}</p>
      ) : (
        <ul className="flex flex-col divide-y divide-border rounded-2xl border border-border">
          {payouts.map((p) => (
            <li key={p.id} className="flex items-center justify-between gap-3 p-3">
              <div className="min-w-0">
                <Link href={routes.order(p.order_id)} className="font-semibold hover:underline">
                  {t('payouts.order', { number: p.order_number })}
                </Link>
                <p className="text-xs text-text-muted">
                  {p.paid && p.completed_at
                    ? t('payouts.paidOn', { date: format.format(new Date(p.completed_at)), bank: p.bank_name, last4: p.account_last4 })
                    : t('payouts.endingIn', { bank: p.bank_name, last4: p.account_last4 })}
                </p>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1">
                <span className="font-bold">{formatNaira(p.amount_kobo)}</span>
                <Badge tone={p.paid ? 'primary' : p.state === 'cancelled' ? 'neutral' : 'accent'}>{t(`payouts.payoutState.${p.state}`)}</Badge>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
