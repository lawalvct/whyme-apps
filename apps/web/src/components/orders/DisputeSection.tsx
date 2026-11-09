'use client';

import { useRef, useState, type FormEvent } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ApiRequestError,
  orderKeys,
  unwrap,
  useApi,
  useDispute,
  type Dispute,
  type DisputeCategory,
  type Order,
} from '@whyme/data';
import { errorKey } from '@whyme/i18n';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/components/ui/cn';
import { TextAreaField, TextField } from '@/components/ui/field';
import { Skeleton } from '@/components/ui/skeleton';
import { formatNaira, nairaToKobo } from '@/lib/format';
import { useLanguage, useT } from '@/lib/i18n';

const CATEGORIES: DisputeCategory[] = ['not_delivered', 'wrong_or_incomplete', 'quality', 'refund_disagreement', 'outside_payment', 'other'];

function apiMessage(t: (key: string) => string, e: unknown): string {
  return t(errorKey(e instanceof ApiRequestError ? e.code : 'network_error'));
}

/**
 * Buyer: "Report a problem" (DSP02). Says what's wrong and, optionally, how much is
 * affected. WHY ME holds the order's money from the moment it's sent.
 */
export function ReportProblem({ order }: { order: Order }) {
  const { t } = useT('orders');
  const api = useApi();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState<DisputeCategory | null>(null);
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  // One key per report: a retry after a lost response returns the same report.
  const key = useRef<string | null>(null);
  const total = formatNaira(order.total_kobo);

  const report = useMutation({
    mutationFn: async (body: { category: DisputeCategory; description: string; amount_kobo: number | null }) => {
      key.current ??= crypto.randomUUID();
      return unwrap(
        await api.POST('/v1/orders/{order}/disputes', {
          params: { path: { order: order.id } },
          body,
          headers: { 'Idempotency-Key': key.current },
        }),
      ).data;
    },
    onSuccess: (dispute) => {
      queryClient.setQueryData(orderKeys.dispute(dispute.id), dispute);
      // Show the case straight away; the refetch below brings the order's own new state.
      queryClient.setQueryData<Order>(orderKeys.order(order.id), (current) =>
        current
          ? { ...current, dispute: { id: dispute.id, state: dispute.state, active: true, outcome: null }, can_report_problem: false }
          : current,
      );
      void queryClient.invalidateQueries({ queryKey: orderKeys.all });
      setOpen(false);
    },
    onError: (e) => {
      const fields = ((e instanceof ApiRequestError ? e.body : null) as { fields?: Record<string, string[]> } | null)?.fields ?? {};
      setErrors(Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, v[0] ?? ''])));
      setError(apiMessage(t, e));
    },
  });

  function submit(event: FormEvent) {
    event.preventDefault();
    if (report.isPending) return;
    const problems: Record<string, string> = {};
    if (!category) problems.category = t('problem.categoryRequired');
    if (description.trim().length < 20) problems.description = t('problem.descriptionRequired');
    const kobo = nairaToKobo(amount);
    if (kobo !== null && (Number.isNaN(kobo) || kobo < 1 || kobo > order.total_kobo)) problems.amount_kobo = t('problem.amountInvalid', { total });
    setErrors(problems);
    setError(null);
    if (Object.keys(problems).length > 0 || !category) return;
    report.mutate({ category, description: description.trim(), amount_kobo: kobo });
  }

  if (!open) {
    return (
      <section className="flex flex-col gap-2 rounded-2xl border border-border p-4">
        <p className="text-sm text-text-muted">{t('problem.reportIntro')}</p>
        <Button variant="secondary" onClick={() => setOpen(true)} className="self-start">
          {t('problem.report')}
        </Button>
      </section>
    );
  }

  return (
    <form method="post" onSubmit={submit} noValidate className="flex flex-col gap-4 rounded-2xl border border-border p-4">
      <div>
        <h2 className="font-bold">{t('problem.title')}</h2>
        <p className="mt-1 text-sm text-text-muted">{t('problem.reportIntro')}</p>
      </div>
      <fieldset className="flex flex-col gap-2">
        <legend className="sr-only">{t('problem.title')}</legend>
        {CATEGORIES.map((value) => (
          <label
            key={value}
            className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border border-border px-3 py-2 has-checked:border-primary has-checked:bg-primary-soft/40"
          >
            <input
              type="radio"
              name="category"
              value={value}
              checked={category === value}
              onChange={() => setCategory(value)}
              className="size-5 shrink-0 accent-primary"
            />
            <span className="text-sm">{t(`problem.category.${value}`)}</span>
          </label>
        ))}
        {errors.category ? (
          <p role="alert" className="text-sm text-danger">
            {errors.category}
          </p>
        ) : null}
      </fieldset>
      <TextAreaField
        label={t('problem.description')}
        hint={t('problem.descriptionHint')}
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        rows={4}
        maxLength={2000}
        error={errors.description}
      />
      <TextField
        label={t('problem.amount')}
        hint={t('problem.amountHint', { total })}
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        inputMode="decimal"
        className="max-w-60"
        error={errors.amount_kobo}
      />
      {error ? (
        <p role="alert" className="rounded-lg bg-surface p-3 text-sm text-danger">
          {error}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={report.isPending}>
          {report.isPending ? t('problem.sending') : t('problem.send')}
        </Button>
        <Button type="button" variant="ghost" disabled={report.isPending} onClick={() => setOpen(false)}>
          {t('problem.cancel')}
        </Button>
      </div>
    </form>
  );
}

/**
 * The case on an order, for both sides: what was reported, where it stands, everyone's
 * statements (staff shown as "WHY ME"), and the outcome with its reason (DSP03, DSP04).
 */
export function DisputePanel({ order }: { order: Order }) {
  const { t } = useT('orders');
  const language = useLanguage();
  const dispute = useDispute(order.dispute?.id);

  if (!order.dispute) return null;
  if (dispute.isPending) return <Skeleton className="h-40 w-full" />;
  if (dispute.isError) {
    return (
      <p role="alert" className="rounded-2xl bg-surface p-4 text-sm text-danger">
        {apiMessage(t, dispute.error)}
      </p>
    );
  }

  const data = dispute.data;
  const active = data.can_add_statement;
  const format = new Intl.DateTimeFormat(language === 'ig' ? 'ig-NG' : 'en-NG', { dateStyle: 'medium', timeStyle: 'short' });
  const total = formatNaira(order.total_kobo);

  return (
    <section className={cn('flex flex-col gap-4 rounded-2xl border p-4', active ? 'border-accent bg-accent-soft/40' : 'border-border')}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-bold">{t('problem.panelTitle')}</h2>
        <Badge tone={active ? 'warning' : 'neutral'}>{t(`problem.state.${data.state}`)}</Badge>
      </div>

      {active ? <p className="text-sm">{data.role === 'buyer' ? t('problem.buyerActive', { total }) : t('problem.sellerActive')}</p> : null}
      {active && data.evidence_due_at ? (
        <p className="text-sm font-semibold">{t('problem.evidenceDue', { date: format.format(new Date(data.evidence_due_at)) })}</p>
      ) : null}
      <Outcome dispute={data} />

      <div className="rounded-xl bg-background p-3 text-sm">
        <p className="font-semibold">{t(`problem.category.${data.category}`)}</p>
        <p className="mt-1 whitespace-pre-line">{data.description}</p>
        <p className="mt-2 text-xs text-text-muted">
          {data.opened_at ? t('problem.reported', { date: format.format(new Date(data.opened_at)) }) : null}
          {data.amount_kobo !== order.total_kobo ? ` · ${formatNaira(data.amount_kobo)}` : null}
        </p>
      </div>

      {data.statements.length > 0 ? (
        <ol className="flex flex-col gap-2">
          {data.statements.map((s, i) => (
            <li
              key={i}
              className={cn(
                'max-w-[85%] rounded-xl px-3 py-2 text-sm',
                s.mine ? 'self-end bg-primary-soft' : s.author === 'admin' ? 'self-start border border-primary bg-background' : 'self-start bg-surface',
              )}
            >
              <p className="text-xs font-semibold text-text-muted">
                {s.mine ? t('problem.author.mine') : t(`problem.author.${s.author}`)} · {format.format(new Date(s.at))}
              </p>
              <p className="mt-0.5 whitespace-pre-line">{s.body}</p>
            </li>
          ))}
        </ol>
      ) : null}

      {active ? <AddStatement dispute={data} /> : null}
      {data.can_withdraw ? <Withdraw dispute={data} /> : null}
    </section>
  );
}

function Outcome({ dispute }: { dispute: Dispute }) {
  const { t } = useT('orders');
  if (!dispute.outcome) return null;
  if (dispute.outcome === 'withdrawn') {
    return <p className="text-sm">{dispute.role === 'buyer' ? t('problem.withdrawn') : t('problem.withdrawnSeller')}</p>;
  }
  const refund = formatNaira(dispute.refund_kobo ?? 0);
  return (
    <div className="flex flex-col gap-1 rounded-xl bg-primary-soft/40 p-3 text-sm">
      <p className="font-semibold">{t(`problem.outcome.${dispute.outcome}`, { refund })}</p>
      {dispute.resolution_note ? <p>{t('problem.reason', { reason: dispute.resolution_note })}</p> : null}
      {dispute.outcome === 'refund_full' || dispute.outcome === 'refund_partial' ? (
        <p className="text-text-muted">{t('problem.refundFollows')}</p>
      ) : null}
    </div>
  );
}

function AddStatement({ dispute }: { dispute: Dispute }) {
  const { t } = useT('orders');
  const api = useApi();
  const queryClient = useQueryClient();
  const [body, setBody] = useState('');
  const [error, setError] = useState<string | null>(null);

  const send = useMutation({
    mutationFn: async (text: string) =>
      unwrap(await api.POST('/v1/disputes/{dispute}/statements', { params: { path: { dispute: dispute.id } }, body: { body: text } })).data,
    onSuccess: (fresh) => {
      queryClient.setQueryData(orderKeys.dispute(dispute.id), fresh);
      setBody('');
    },
    onError: (e) => setError(apiMessage(t, e)),
  });

  return (
    <form
      method="post"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        if (send.isPending || body.trim().length < 2) return;
        setError(null);
        send.mutate(body.trim());
      }}
      className="flex flex-col gap-2"
    >
      <TextAreaField
        label={dispute.role === 'buyer' ? t('problem.add') : t('problem.addSeller')}
        hint={t('problem.addHint')}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={2}
        maxLength={2000}
        error={error ?? undefined}
      />
      <Button type="submit" variant="secondary" disabled={send.isPending || body.trim().length < 2} className="self-start">
        {send.isPending ? t('common:loading') : t('problem.addSend')}
      </Button>
    </form>
  );
}

function Withdraw({ dispute }: { dispute: Dispute }) {
  const { t } = useT('orders');
  const api = useApi();
  const queryClient = useQueryClient();
  const [asking, setAsking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const withdraw = useMutation({
    mutationFn: async () =>
      unwrap(
        await api.POST('/v1/disputes/{dispute}/withdraw', { params: { path: { dispute: dispute.id } }, body: { version: dispute.version } }),
      ).data,
    onSuccess: (fresh) => {
      queryClient.setQueryData(orderKeys.dispute(dispute.id), fresh);
      void queryClient.invalidateQueries({ queryKey: orderKeys.all });
    },
    onError: (e) => setError(apiMessage(t, e)),
  });

  if (!asking) {
    return (
      <button type="button" onClick={() => setAsking(true)} className="self-start text-sm font-semibold text-primary hover:underline">
        {t('problem.withdraw')}
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-2 border-t border-border pt-3">
      <p className="text-sm">{t('problem.withdrawQuestion')}</p>
      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" disabled={withdraw.isPending} onClick={() => withdraw.mutate()}>
          {withdraw.isPending ? t('common:loading') : t('problem.withdrawYes')}
        </Button>
        <Button variant="ghost" disabled={withdraw.isPending} onClick={() => setAsking(false)}>
          {t('problem.keep')}
        </Button>
      </div>
      {error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}
