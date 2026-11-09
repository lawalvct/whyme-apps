'use client';

import type { Order } from '@whyme/data';
import { Badge } from '@/components/ui/badge';
import { formatNaira } from '@/lib/format';
import { useLanguage, useT } from '@/lib/i18n';

type Refund = Order['refunds'][number];

/**
 * Refunded, or on its way back to the buyer (PAY08: started is not done). `done` and `open` are
 * what the order gave back; the buyer receives that less Paystack's payment fee (`toBuyer…`).
 */
export function refundTotals(order: Order): { done: number; open: number; toBuyerDone: number; toBuyerOpen: number } {
  let done = 0;
  let open = 0;
  let toBuyerDone = 0;
  let toBuyerOpen = 0;
  for (const r of order.refunds) {
    if (r.state === 'succeeded') {
      done += r.amount_kobo;
      toBuyerDone += r.to_buyer_kobo;
    } else if (r.state !== 'failed') {
      open += r.amount_kobo;
      toBuyerOpen += r.to_buyer_kobo;
    }
  }
  return { done, open, toBuyerDone, toBuyerOpen };
}

/**
 * Money WHY ME sent back to the buyer, for both sides. A refund counts as done only once
 * Paystack confirms it; before that it is "on its way".
 */
export function RefundsSection({ order }: { order: Order }) {
  const { t } = useT('orders');
  const language = useLanguage();
  if (order.refunds.length === 0) return null;
  const format = new Intl.DateTimeFormat(language === 'ig' ? 'ig-NG' : 'en-NG', { dateStyle: 'medium' });
  const anyDone = order.refunds.some((r) => r.state === 'succeeded');

  return (
    <section className="flex flex-col gap-3 rounded-2xl border border-border p-4">
      <h2 className="font-bold">{t('refund.title')}</h2>
      <ul className="flex flex-col gap-3">
        {order.refunds.map((refund) => (
          <RefundRow key={refund.id} refund={refund} format={format} buyer={order.role === 'buyer'} />
        ))}
      </ul>
      {order.role === 'buyer' && anyDone ? <p className="text-xs text-text-muted">{t('refund.bankDelay')}</p> : null}
    </section>
  );
}

function RefundRow({ refund, format, buyer }: { refund: Refund; format: Intl.DateTimeFormat; buyer: boolean }) {
  const { t } = useT('orders');
  const tone = refund.state === 'succeeded' ? 'primary' : refund.state === 'failed' ? 'warning' : 'accent';
  const date = refund.state === 'succeeded' && refund.completed_at ? refund.completed_at : refund.requested_at;

  return (
    <li className="flex flex-col gap-1 text-sm">
      <div className="flex items-center justify-between gap-3">
        <span className="font-semibold">{formatNaira(refund.amount_kobo)}</span>
        <Badge tone={tone}>{t(`refund.state.${refund.state}`)}</Badge>
      </div>
      {refund.fee_kobo > 0 ? (
        // Paystack keeps its payment fee on the refunded part, and the buyer bears it (owner's decision).
        <dl className="flex flex-col gap-0.5 text-xs">
          <div className="flex justify-between gap-3 text-text-muted">
            <dt>{t('refund.paystackFee')}</dt>
            <dd>−{formatNaira(refund.fee_kobo)}</dd>
          </div>
          <div className="flex justify-between gap-3 font-semibold">
            <dt>{t(buyer ? 'refund.youReceive' : 'refund.buyerReceives')}</dt>
            <dd>{formatNaira(refund.to_buyer_kobo)}</dd>
          </div>
        </dl>
      ) : null}
      {date ? (
        <p className="text-xs text-text-muted">
          {t(refund.state === 'succeeded' ? 'refund.done' : 'refund.requested', { date: format.format(new Date(date)) })}
        </p>
      ) : null}
      {refund.note ? <p className="text-text-muted">{refund.note}</p> : null}
      {refund.state === 'failed' ? <p className="text-text-muted">{t('refund.failedNote')}</p> : null}
      {refund.state === 'needs_attention' ? <p className="text-text-muted">{t('refund.needsAttentionNote')}</p> : null}
    </li>
  );
}
