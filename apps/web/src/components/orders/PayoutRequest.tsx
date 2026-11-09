'use client';

import Link from 'next/link';
import { useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ApiRequestError, orderKeys, payoutKeys, unwrap, useApi, usePayoutBreakdown, type Order, type PayoutBreakdown } from '@whyme/data';
import { errorKey } from '@whyme/i18n';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { formatNaira, routes } from '@/lib/format';
import { useLanguage, useT } from '@/lib/i18n';

/**
 * Seller, delivered and confirmed order: what they'll receive and why, then "Request payout"
 * (owner's decision). The commission comes off; Paystack's fees are WHY ME's and don't. WHY ME
 * staff still approve the release, so asking moves no money by itself.
 */
export function PayoutRequest({ order }: { order: Order }) {
  const { t } = useT('orders');
  const language = useLanguage();
  const api = useApi();
  const queryClient = useQueryClient();
  const breakdown = usePayoutBreakdown(order.id);
  const [error, setError] = useState<string | null>(null);
  const inFlight = useRef(false);

  const request = useMutation({
    mutationFn: async () =>
      unwrap(
        await api.POST('/v1/orders/{order}/payout', {
          params: { path: { order: order.id } },
          headers: { 'Idempotency-Key': crypto.randomUUID() },
        }),
      ).data,
    onMutate: () => setError(null),
    onSuccess: (fresh) => {
      queryClient.setQueryData(payoutKeys.order(order.id), fresh);
      void queryClient.invalidateQueries({ queryKey: orderKeys.order(order.id), exact: true });
      void queryClient.invalidateQueries({ queryKey: payoutKeys.earnings });
    },
    onError: (e) => {
      const apiError = e instanceof ApiRequestError ? e : null;
      // Something changed since the page loaded (a check now fails): show the current picture.
      if (apiError?.status === 409) void breakdown.refetch();
      setError(t(errorKey(apiError?.code ?? 'network_error')));
    },
    onSettled: () => {
      inFlight.current = false;
    },
  });

  if (breakdown.isPending) return <Skeleton className="h-48 w-full" />;
  if (breakdown.isError) {
    return (
      <p role="alert" className="rounded-2xl bg-surface p-4 text-sm text-danger">
        {t('payout.loadFailed')}
      </p>
    );
  }

  const b = breakdown.data;
  const amount = formatNaira(b.you_receive_kobo);
  const declined = order.payout?.state === 'cancelled' ? order.payout.declined_reason : null;
  const asked = b.request?.requested_at
    ? new Intl.DateTimeFormat(language === 'ig' ? 'ig-NG' : 'en-NG', { dateStyle: 'medium' }).format(new Date(b.request.requested_at))
    : null;

  function send() {
    if (inFlight.current) return;
    inFlight.current = true;
    request.mutate();
  }

  return (
    <section className={`flex flex-col gap-3 rounded-2xl p-4 ${b.can_request ? 'bg-accent-soft' : 'bg-surface'}`}>
      {b.request ? (
        <p className="font-semibold" role="status">
          {t('payout.requested', { amount, date: asked ?? '' })}
        </p>
      ) : (
        <p className="font-semibold">{t('payout.readyTitle', { amount })}</p>
      )}
      {declined && !b.request ? <p className="text-sm text-warning">{t('payout.declined', { reason: declined })}</p> : null}

      <Breakdown b={b} />

      {b.bank ? (
        <p className="text-sm">{t('payout.toBank', { bank: b.bank.bank_name, last4: b.bank.account_last4, name: b.bank.account_name })}</p>
      ) : null}

      {!b.request && b.blockers.length > 0 ? (
        <ul className="flex flex-col gap-1 text-sm">
          {b.blockers.map((code) => (
            <li key={code}>
              {t(`payout.blocker.${code}`, { defaultValue: t('payout.blocker.other') })}
              {code === 'no_payout_account' ? (
                <>
                  {' '}
                  <Link href={routes.sellPayouts} className="font-semibold text-primary hover:underline">
                    {t('payout.addBank')}
                  </Link>
                </>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}

      {b.can_request ? (
        <div className="flex flex-col gap-2">
          <p className="text-xs text-text-muted">{t('payout.requestHint')}</p>
          <Button disabled={request.isPending} onClick={send} className="self-start">
            {request.isPending ? t('payout.requesting') : t('payout.request', { amount })}
          </Button>
        </div>
      ) : null}
      {b.request ? <p className="text-sm text-text-muted">{t('payout.requestedNext')}</p> : null}
      {error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}
    </section>
  );
}

/** Sale, refunds, commission and what the seller receives; then the fees WHY ME pays for them. */
function Breakdown({ b }: { b: PayoutBreakdown }) {
  const { t } = useT('orders');
  const rate = (b.commission_bps / 100).toLocaleString('en-NG', { maximumFractionDigits: 2 });

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-border bg-background p-3 text-sm">
      <dl className="flex flex-col gap-1.5">
        <Line label={t('payout.sale')} value={formatNaira(b.sale_kobo)} />
        {b.refunded_kobo > 0 ? <Line label={t('payout.refunded')} value={`−${formatNaira(b.refunded_kobo)}`} /> : null}
        <Line label={t('payout.commission', { rate })} value={b.commission_kobo > 0 ? `−${formatNaira(b.commission_kobo)}` : formatNaira(0)} />
        <div className="mt-1 flex items-baseline justify-between gap-4 border-t border-border pt-2 text-base font-bold">
          <dt>{t('payout.youReceive')}</dt>
          <dd>{formatNaira(b.you_receive_kobo)}</dd>
        </div>
      </dl>
      <div className="flex flex-col gap-1 border-t border-border pt-2 text-xs text-text-muted">
        <p className="font-semibold text-text">{t('payout.feesTitle')}</p>
        <dl className="flex flex-col gap-0.5">
          <Line label={t('payout.processingFee')} value={formatNaira(b.processing_fee_kobo)} />
          <Line label={t(b.final ? 'payout.transferFee' : 'payout.transferFeeAbout')} value={formatNaira(b.transfer_fee_kobo)} />
        </dl>
        <p>{t('payout.feesNote')}</p>
      </div>
    </div>
  );
}

function Line({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="text-text-muted">{label}</dt>
      <dd className="text-right font-medium">{value}</dd>
    </div>
  );
}
