'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ApiRequestError, orderKeys, paymentIsOpen, unwrap, useApi, useOrder, type Order, type OrderAction } from '@whyme/data';
import { errorKey } from '@whyme/i18n';
import { useStartConversation } from '@/components/chat/useStartConversation';
import { ReturnsPolicy } from '@/components/market/ReturnsPolicy';
import { PaymentMethods } from '@/components/payments/PaymentMethods';
import { Button } from '@/components/ui/button';
import { cn } from '@/components/ui/cn';
import { TextAreaField } from '@/components/ui/field';
import { Skeleton } from '@/components/ui/skeleton';
import { formatNaira, routes } from '@/lib/format';
import { useLanguage, useT } from '@/lib/i18n';
import { useUserEvents } from '@/lib/realtime';
import { useAccount } from '@/lib/session';
import { DisputePanel, ReportProblem } from './DisputeSection';
import { PayoutRequest } from './PayoutRequest';
import { RefundsSection, refundTotals } from './RefundsSection';
import { FundsStatus, OrderStatus, eventLabel } from './OrderStatus';

/** How long the page keeps re-checking a payment the bank is still confirming. */
const CHECK_EVERY_MS = 5_000;
const MAX_AUTO_CHECKS = 12;

/**
 * One order (ORD06). Coming back from Paystack, the page asks the API to check the payment
 * with Paystack; it never takes the browser's word for it (PAY04). A bank transfer that is
 * still being confirmed is re-checked for about a minute, and Pusher updates it after that.
 */
export function OrderView({ id }: { id: string }) {
  const { t } = useT('orders');
  const api = useApi();
  const queryClient = useQueryClient();
  const { user } = useAccount();
  const searchParams = useSearchParams();
  const returned = searchParams.has('reference') || searchParams.has('trxref');
  const order = useOrder(id);

  useUserEvents(user?.id, {
    'order.updated': (data) => {
      // This order, plus the lists and the header badge (only what's on screen refetches).
      if ((data as { order_id?: string }).order_id === id) void queryClient.invalidateQueries({ queryKey: orderKeys.all });
    },
  });

  const check = useMutation({
    mutationFn: async () =>
      unwrap(await api.POST('/v1/orders/{order}/payment/check', { params: { path: { order: id } } })).data,
    onSuccess: (fresh) => {
      queryClient.setQueryData(orderKeys.order(id), fresh);
      void queryClient.invalidateQueries({ queryKey: orderKeys.all, exact: false, refetchType: 'none' });
    },
  });

  // Ask Paystack once on arrival (and then every few seconds while the bank confirms).
  const checks = useRef(0);
  const role = order.data?.role;
  const paymentState = order.data?.payment?.state;
  const unpaid = order.data?.fulfilment_state === 'awaiting_payment';
  useEffect(() => {
    if (role !== 'buyer' || !unpaid || !paymentIsOpen(paymentState) || check.isPending) return;
    if (checks.current === 0) {
      checks.current = 1;
      check.mutate();
      return;
    }
    if (paymentState !== 'pending_verification' && !(returned && checks.current < 3)) return;
    if (checks.current >= MAX_AUTO_CHECKS) return;
    const timer = window.setTimeout(() => {
      checks.current += 1;
      check.mutate();
    }, CHECK_EVERY_MS);
    return () => window.clearTimeout(timer);
  }, [role, unpaid, paymentState, returned, check]);

  if (order.isPending) {
    return (
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-4">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }
  if (order.isError) {
    const code = order.error instanceof ApiRequestError ? order.error.code : null;
    return (
      <p role="alert" className="mx-auto max-w-2xl rounded-lg bg-surface p-4 text-danger">
        {code === 'not_found' || (order.error instanceof ApiRequestError && order.error.status === 404) ? t('errors:not_found') : t('orderLoadFailed')}
      </p>
    );
  }

  const data = order.data;
  // The first check on arrival: show "checking" instead of an unpaid banner that may be about to change.
  const checking = check.isPending && check.data === undefined && data.fulfilment_state === 'awaiting_payment';

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-5">
      <Link href={routes.orders(data.role === 'seller' ? 'sold' : undefined)} className="text-sm font-semibold text-primary hover:underline">
        ← {t('allOrders')}
      </Link>

      <header className="flex items-center gap-4">
        <div className="size-20 shrink-0 overflow-hidden rounded-lg bg-surface">
          {data.thumb ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={data.thumb} alt="" className="size-full object-cover" />
          ) : null}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold tracking-wide text-text-muted uppercase">{t('orderNumber', { number: data.number })}</p>
          <h1 className="text-xl leading-snug font-bold">{data.title}</h1>
          <p className="text-sm text-text-muted">
            {data.role === 'seller' ? t('buyer') : t('seller')}: {data.other_party.name}
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <OrderStatus order={data} />
            <FundsStatus order={data} />
          </div>
        </div>
      </header>

      {checking ? (
        <p role="status" className="rounded-2xl bg-surface p-4">
          {t('checking')}
        </p>
      ) : (
        <Banner order={data} onCheck={() => check.mutate()} checkingNow={check.isPending} />
      )}

      <DisputePanel order={data} />
      {data.can_report_problem ? <ReportProblem order={data} /> : null}

      <Amounts order={data} />
      <RefundsSection order={data} />
      <Fulfilment order={data} />
      <History order={data} />
    </div>
  );
}

function Banner({ order, onCheck, checkingNow }: { order: Order; onCheck: () => void; checkingNow: boolean }) {
  const { t } = useT('orders');
  const language = useLanguage();
  const total = formatNaira(order.total_kobo);
  const payment = order.payment?.state;
  const state = order.fulfilment_state;
  const pickup = order.fulfilment_method === 'pickup';

  if (order.role === 'seller') {
    switch (state) {
      case 'paid':
        return (
          <Panel tone="action">
            <p className="font-semibold">{t('sellerPaidBanner', { total })}</p>
            <p className="text-sm">{t('sellerPaidNext')}</p>
            <AcceptOrDecline order={order} />
          </Panel>
        );
      case 'accepted':
      case 'dispatched':
        return (
          <Panel tone="action">
            <p className="text-sm">{t(state === 'accepted' ? 'sellerAcceptedNext' : 'sellerDispatchedNext')}</p>
            {/* Keyed by state: the note box starts empty again after each step. */}
            <SellerProgress key={state} order={order} />
          </Panel>
        );
      case 'completion_submitted':
        return (
          <Panel>
            <p>{t('sellerWaitingConfirm')}</p>
            <ConfirmDeadline order={order} role="seller" />
          </Panel>
        );
      case 'completed':
        // With a problem reported, the dispute panel says where the money is instead.
        if (order.dispute?.active) return null;
        // Approved by WHY ME: where the transfer is. Asked for, declined or not asked yet: the breakdown.
        if (order.payout && order.payout.state !== 'requested' && order.payout.state !== 'cancelled') {
          const p = order.payout;
          const amount = formatNaira(p.amount_kobo);
          if (p.paid) {
            const date = p.completed_at ? new Intl.DateTimeFormat(language === 'ig' ? 'ig-NG' : 'en-NG', { dateStyle: 'medium' }).format(new Date(p.completed_at)) : '';
            return <Panel tone="done">{t('payout.paid', { amount, bank: p.bank_name, last4: p.account_last4, date })}</Panel>;
          }
          return (
            <Panel>
              {['reconciliation_required', 'needs_funding', 'failed', 'reversed'].includes(p.state)
                ? t('payout.checking', { amount })
                : t('payout.onItsWay', { amount, bank: p.bank_name, last4: p.account_last4 })}
            </Panel>
          );
        }
        if (order.funds_state === 'release_eligible') return <PayoutRequest order={order} />;
        if (order.refunds.some((r) => r.state !== 'failed')) {
          const refunds = refundTotals(order);
          return (
            <Panel>
              <p>{t('refund.sellerRefunded', { amount: formatNaira(refunds.done + refunds.open) })}</p>
              <p className="text-sm">{t('refund.sellerRest')}</p>
            </Panel>
          );
        }
        return (
          <Panel tone="done">{t('sellerCompletedHeld')}</Panel>
        );
      case 'cancelled':
        return <Panel>{t('sellerDeclined')}</Panel>;
      default:
        return null;
    }
  }

  switch (state) {
    case 'paid':
      return (
        <Panel tone="done">
          <p className="font-semibold">{t('buyerPaidWaiting', { total })}</p>
          <MessageSeller order={order} />
        </Panel>
      );
    case 'accepted':
      return (
        <Panel tone="done">
          <p>{t('buyerAccepted')}</p>
          <MessageSeller order={order} />
        </Panel>
      );
    case 'dispatched':
    case 'completion_submitted':
      return (
        <Panel tone="action">
          <p>{t(state === 'completion_submitted' ? 'buyerDelivered' : pickup ? 'buyerDispatchedPickup' : 'buyerDispatchedDelivery')}</p>
          {/* Confirming would release money WHY ME is holding for a reported problem. */}
          {order.dispute?.active ? <p className="text-sm font-semibold">{t('problem.confirmPaused')}</p> : <ConfirmReceipt order={order} />}
        </Panel>
      );
    case 'completed': {
      // With a problem reported, the dispute panel says where the money is instead.
      if (order.dispute?.active) return null;
      const refunds = refundTotals(order);
      if (refunds.open > 0) return <Panel>{t('refund.buyerOnItsWay', { amount: formatNaira(refunds.toBuyerOpen) })}</Panel>;
      if (refunds.done > 0) return <Panel tone="done">{t('refund.buyerRefunded', { amount: formatNaira(refunds.toBuyerDone) })}</Panel>;
      return <Panel tone="done">{t('buyerCompleted')}</Panel>;
    }
    case 'cancelled': {
      if (!order.paid_at) return <Panel>{t('buyerCancelled')}</Panel>;
      const refunds = refundTotals(order);
      if (refunds.done > 0 && refunds.open === 0) return <Panel tone="done">{t('refund.buyerRefunded', { amount: formatNaira(refunds.toBuyerDone) })}</Panel>;
      if (refunds.open > 0) return <Panel>{t('refund.buyerOnItsWay', { amount: formatNaira(refunds.toBuyerOpen) })}</Panel>;
      return <Panel>{t('buyerDeclined', { total })}</Panel>;
    }
  }

  // Not paid yet.
  if (payment === 'pending_verification') {
    return (
      <Panel tone="action">
        <p role="status">{t('pendingBanner')}</p>
        <Button variant="secondary" disabled={checkingNow} onClick={onCheck} className="self-start">
          {checkingNow ? t('common:loading') : t('checkNow')}
        </Button>
      </Panel>
    );
  }
  if (payment === 'reconciliation_required') {
    return <Panel tone="action">{t('reviewBanner')}</Panel>;
  }

  return (
    <Panel>
      <p>{payment === 'failed' ? t('failedBanner') : t('awaitingBanner')}</p>
      <PayButton order={order} />
      {payment === 'awaiting_payment' ? (
        <button
          type="button"
          disabled={checkingNow}
          onClick={onCheck}
          className="self-start text-sm font-semibold text-primary hover:underline disabled:opacity-60"
        >
          {t('checkNow')}
        </button>
      ) : null}
      <CancelUnpaid order={order} />
    </Panel>
  );
}

function Panel({ tone = 'info', children }: { tone?: 'info' | 'action' | 'done'; children: ReactNode }) {
  const tones = { info: 'bg-surface', action: 'bg-accent-soft', done: 'bg-primary-soft/40' };
  return <section className={cn('flex flex-col gap-3 rounded-2xl p-4', tones[tone])}>{children}</section>;
}

/**
 * Sends one order action with the version on screen. A 409 brings the current order
 * back with it: the page shows that instead, with a short note (STA01, OFF06).
 */
function useOrderAction(order: Order) {
  const { t } = useT('orders');
  const api = useApi();
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const inFlight = useRef(false);

  const mutation = useMutation({
    mutationFn: async ({ action, note }: { action: OrderAction; note?: string }) => {
      // Every action takes the same body ({ version, note }); one path type keeps the call typed.
      const path = `/v1/orders/{order}/${action}` as '/v1/orders/{order}/accept';
      return unwrap(
        await api.POST(path, { params: { path: { order: order.id } }, body: { version: order.version, note: note || null } }),
      ).data;
    },
    onMutate: () => setError(null),
    onSuccess: (fresh) => {
      queryClient.setQueryData(orderKeys.order(order.id), fresh);
      void queryClient.invalidateQueries({ queryKey: orderKeys.all });
    },
    onError: (e) => {
      const apiError = e instanceof ApiRequestError ? e : null;
      const current = (apiError?.body as { data?: Order } | null)?.data;
      if (apiError?.status === 409 && current) {
        queryClient.setQueryData(orderKeys.order(order.id), current);
        setError(t('changedMeanwhile'));
        return;
      }
      setError(t(errorKey(apiError?.code ?? 'network_error')));
    },
    onSettled: () => {
      inFlight.current = false;
    },
  });

  function run(action: OrderAction, note?: string) {
    if (inFlight.current) return;
    inFlight.current = true;
    mutation.mutate({ action, note });
  }

  return { run, busy: mutation.isPending, pendingAction: mutation.isPending ? mutation.variables?.action : undefined, error };
}

function ActionError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p role="alert" className="text-sm text-danger">
      {message}
    </p>
  );
}

/** Seller, paid order: accept, or decline with a reason the buyer sees (the buyer is refunded). */
function AcceptOrDecline({ order }: { order: Order }) {
  const { t } = useT('orders');
  const { run, busy, pendingAction, error } = useOrderAction(order);
  const [declining, setDeclining] = useState(false);
  const [reason, setReason] = useState('');
  const [reasonError, setReasonError] = useState<string | null>(null);

  if (declining) {
    return (
      <div className="flex flex-col gap-3 rounded-xl border border-border bg-background p-3">
        <p className="font-semibold">{t('declineTitle')}</p>
        <p className="text-sm text-text-muted">{t('declineHint')}</p>
        <TextAreaField
          label={t('declineReason')}
          value={reason}
          onChange={(e) => {
            setReason(e.target.value);
            setReasonError(null);
          }}
          maxLength={300}
          rows={2}
          error={reasonError ?? undefined}
        />
        <div className="flex flex-wrap gap-2">
          <Button
            variant="secondary"
            disabled={busy}
            onClick={() => (reason.trim().length < 5 ? setReasonError(t('declineReasonRequired')) : run('decline', reason.trim()))}
          >
            {pendingAction === 'decline' ? t('common:loading') : t('confirmDecline')}
          </Button>
          <Button variant="ghost" disabled={busy} onClick={() => setDeclining(false)}>
            {t('keepOrder')}
          </Button>
        </div>
        <ActionError message={error} />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs text-text-muted">{t('acceptHint')}</p>
      <div className="flex flex-wrap gap-2">
        <Button disabled={busy} onClick={() => run('accept')}>
          {pendingAction === 'accept' ? t('accepting') : t('accept')}
        </Button>
        <Button variant="secondary" disabled={busy} onClick={() => setDeclining(true)}>
          {t('decline')}
        </Button>
      </div>
      <ActionError message={error} />
    </div>
  );
}

/** Seller, accepted or sent: mark it sent / ready for pickup, then delivered / handed over. */
function SellerProgress({ order }: { order: Order }) {
  const { t } = useT('orders');
  const { run, busy, pendingAction, error } = useOrderAction(order);
  const [note, setNote] = useState('');
  const pickup = order.fulfilment_method === 'pickup';
  const canDispatch = order.fulfilment_state === 'accepted';

  return (
    <div className="flex flex-col gap-3">
      <TextAreaField label={t('noteLabel')} hint={t('noteHint')} value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} rows={2} />
      <div className="flex flex-wrap gap-2">
        {canDispatch ? (
          <Button disabled={busy} onClick={() => run('dispatch', note.trim())}>
            {pendingAction === 'dispatch' ? t('common:loading') : t(pickup ? 'markReady' : 'markSent')}
          </Button>
        ) : null}
        <Button variant={canDispatch ? 'secondary' : 'primary'} disabled={busy} onClick={() => run('complete', note.trim())}>
          {pendingAction === 'complete' ? t('common:loading') : t(pickup ? 'markHandedOver' : 'markDelivered')}
        </Button>
      </div>
      <ActionError message={error} />
    </div>
  );
}

/**
 * Buyer: "I got it" (STA01, DSP01). Two steps, naming the amount and the seller, because
 * it tells WHY ME to release the money. Confirming twice is harmless on the server.
 */
function ConfirmReceipt({ order }: { order: Order }) {
  const { t } = useT('orders');
  const { run, busy, error } = useOrderAction(order);
  const [asking, setAsking] = useState(false);
  const total = formatNaira(order.total_kobo);

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border bg-background p-3">
      <p className="font-semibold">{t('confirmTitle')}</p>
      <p className="text-sm">{t('confirmHint', { total })}</p>
      <ConfirmDeadline order={order} role="buyer" />
      {asking ? (
        <>
          <p className="font-semibold">{t('confirmQuestion', { total, seller: order.other_party.name })}</p>
          <div className="flex flex-wrap gap-2">
            <Button disabled={busy} onClick={() => run('confirm')}>
              {busy ? t('confirming') : t('confirmYes')}
            </Button>
            <Button variant="ghost" disabled={busy} onClick={() => setAsking(false)}>
              {t('notYet')}
            </Button>
          </div>
        </>
      ) : (
        <Button onClick={() => setAsking(true)} className="self-start">
          {t('gotIt')}
        </Button>
      )}
      <ActionError message={error} />
      <p className="text-sm text-text-muted">{t('confirmProblem')}</p>
      <MessageSeller order={order} />
    </div>
  );
}

/**
 * The buyer's deadline to confirm or report a problem (DEC07), and what happens after it:
 * nothing is released by itself; WHY ME staff look at the order.
 */
function ConfirmDeadline({ order, role }: { order: Order; role: 'buyer' | 'seller' }) {
  const { t } = useT('orders');
  const language = useLanguage();
  if (order.buyer_response_overdue) {
    return <p className="text-sm font-semibold">{t(role === 'buyer' ? 'deadlineOverdueBuyer' : 'deadlineOverdueSeller')}</p>;
  }
  if (!order.confirm_due_at) return null;
  const date = new Intl.DateTimeFormat(language === 'ig' ? 'ig-NG' : 'en-NG', { dateStyle: 'medium' }).format(new Date(order.confirm_due_at));
  return <p className="text-sm text-text-muted">{t(role === 'buyer' ? 'deadlineBuyer' : 'deadlineSeller', { date })}</p>;
}

/** Buyer, before paying: cancel the order (nothing was charged). */
function CancelUnpaid({ order }: { order: Order }) {
  const { t } = useT('orders');
  const { run, busy, error } = useOrderAction(order);
  const [asking, setAsking] = useState(false);

  if (!asking) {
    return (
      <button type="button" onClick={() => setAsking(true)} className="self-start text-sm font-semibold text-text-muted hover:text-danger hover:underline">
        {t('cancelOrder')}
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-2 border-t border-border pt-3">
      <p className="text-sm">{t('cancelQuestion')}</p>
      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" disabled={busy} onClick={() => run('cancel')}>
          {busy ? t('common:loading') : t('cancelYes')}
        </Button>
        <Button variant="ghost" disabled={busy} onClick={() => setAsking(false)}>
          {t('keepOrder')}
        </Button>
      </div>
      <ActionError message={error} />
    </div>
  );
}

/** Opens Paystack again for an unpaid order. The API reuses an open checkout rather than starting a new charge. */
function PayButton({ order }: { order: Order }) {
  const { t } = useT('orders');
  const api = useApi();
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inFlight = useRef(false);

  async function pay() {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setError(null);
    try {
      const result = unwrap(
        await api.POST('/v1/orders/{order}/pay', {
          params: { path: { order: order.id } },
          body: {},
          headers: { 'Idempotency-Key': crypto.randomUUID() },
        }),
      ).data;
      if (result.checkout_url) {
        window.location.assign(result.checkout_url);
        return;
      }
      await queryClient.invalidateQueries({ queryKey: orderKeys.order(order.id) });
    } catch (e) {
      setError(t(errorKey(e instanceof ApiRequestError ? e.code : 'network_error')));
    }
    inFlight.current = false;
    setBusy(false);
  }

  return (
    <div className="flex flex-col gap-2">
      <Button disabled={busy} onClick={() => void pay()} className="self-start">
        {busy ? t('opening') : t('continuePayment', { total: formatNaira(order.total_kobo) })}
      </Button>
      <PaymentMethods />
      {error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function MessageSeller({ order }: { order: Order }) {
  const { t } = useT('orders');
  const startConversation = useStartConversation();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!order.listing_id) return null;

  async function open() {
    setBusy(true);
    setError(null);
    try {
      await startConversation({ type: 'listing', id: order.listing_id! });
    } catch (e) {
      setError(t(errorKey(e instanceof ApiRequestError ? e.code : 'network_error')));
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <Button variant="secondary" disabled={busy} onClick={() => void open()} className="self-start">
        {busy ? t('common:loading') : t('messageSeller')}
      </Button>
      {error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function Amounts({ order }: { order: Order }) {
  const { t } = useT('orders');
  return (
    <section className="rounded-2xl border border-border p-4">
      <h2 className="mb-3 font-bold">{t('summary')}</h2>
      <dl className="flex flex-col gap-2 text-sm">
        <Row label={t('items', { count: order.quantity, price: formatNaira(order.unit_price_kobo) })} value={formatNaira(order.subtotal_kobo)} />
        {order.fulfilment_method === 'delivery' ? (
          <Row label={t('delivery')} value={order.delivery_fee_kobo ? formatNaira(order.delivery_fee_kobo) : t('noCharge')} />
        ) : null}
        {order.buyer_fee_kobo ? <Row label={t('serviceFee')} value={formatNaira(order.buyer_fee_kobo)} /> : null}
        <div className="mt-1 flex items-baseline justify-between border-t border-border pt-3 text-base font-bold">
          <dt>{t('total')}</dt>
          <dd>{formatNaira(order.total_kobo)}</dd>
        </div>
        {order.seller_net_kobo !== null ? <Row label={t('sellerNet')} value={formatNaira(order.seller_net_kobo)} /> : null}
        {order.payment ? (
          <>
            <Row
              label={t('payment.' + order.payment.state)}
              value={order.payment.state === 'succeeded' && order.payment.channel ? t('paidVia', { channel: order.payment.channel.replace('_', ' ') }) : ''}
            />
            <Row label={t('reference')} value={order.payment.reference} />
          </>
        ) : null}
      </dl>
    </section>
  );
}

function Fulfilment({ order }: { order: Order }) {
  const { t } = useT('orders');
  return (
    <section className="rounded-2xl border border-border p-4 text-sm">
      {order.fulfilment_method === 'delivery' && order.delivery ? (
        <>
          <h2 className="mb-2 text-base font-bold">{t('deliveryTo')}</h2>
          <p>{order.delivery.address}</p>
          {order.delivery.area ? <p className="text-text-muted">{order.delivery.area}</p> : null}
          {order.delivery.note ? <p className="mt-2 whitespace-pre-line">{order.delivery.note}</p> : null}
        </>
      ) : (
        <>
          <h2 className="mb-1 text-base font-bold">{t('pickup')}</h2>
          <p className="text-text-muted">{t('pickupNote')}</p>
        </>
      )}
      <ReturnsPolicy terms={order.refund_policy} label={t('returnsAgreed')} className="mt-3" />
      {order.listing_id ? (
        <Link href={routes.listing({ id: order.listing_id })} className="mt-3 inline-block font-semibold text-primary hover:underline">
          {t('viewItem')}
        </Link>
      ) : null}
    </section>
  );
}

function History({ order }: { order: Order }) {
  const { t } = useT('orders');
  const language = useLanguage();
  const events = order.events ?? [];
  if (events.length === 0) return null;
  const format = new Intl.DateTimeFormat(language === 'ig' ? 'ig-NG' : 'en-NG', { dateStyle: 'medium', timeStyle: 'short' });

  return (
    <section className="rounded-2xl border border-border p-4">
      <h2 className="mb-3 font-bold">{t('history')}</h2>
      <ol className="flex flex-col gap-3 text-sm">
        {[...events].reverse().map((event, i) => (
          <li key={i} className="flex flex-col gap-1">
            <div className="flex justify-between gap-4">
              <span>
                {eventLabel(t, order, event)}
                {event.actor === 'buyer' || event.actor === 'seller' ? <span className="text-text-muted"> · {t(`by.${event.actor}`)}</span> : null}
              </span>
              <time dateTime={event.at} className="shrink-0 text-text-muted">
                {format.format(new Date(event.at))}
              </time>
            </div>
            {event.note ? <p className="rounded-lg bg-surface px-3 py-2 whitespace-pre-line">“{event.note}”</p> : null}
          </li>
        ))}
      </ol>
    </section>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="text-text-muted">{label}</dt>
      <dd className="text-right font-medium break-all">{value}</dd>
    </div>
  );
}
