'use client';

import Link from 'next/link';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  ApiRequestError,
  requestKeys,
  unwrap,
  useApi,
  useOfflineCopy,
  useServiceRequest,
  type ServiceQuote,
  type ServiceRequest,
} from '@whyme/data';
import { errorKey } from '@whyme/i18n';
import { useStartConversation } from '@/components/chat/useStartConversation';
import { PhotoGallery } from '@/components/market/PhotoGallery';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { TextAreaField, TextField } from '@/components/ui/field';
import { Skeleton } from '@/components/ui/skeleton';
import { formatNaira, koboToNaira, nairaToKobo, routes } from '@/lib/format';
import { useLanguage, useT } from '@/lib/i18n';
import { useRealtimeConnected, useUserEvents } from '@/lib/realtime';
import { useAccount } from '@/lib/session';
import { requestEventLabel, RequestStatusBadge } from './RequestStatus';

type ActionPath =
  | '/v1/requests/{serviceRequest}/accept'
  | '/v1/requests/{serviceRequest}/decline'
  | '/v1/requests/{serviceRequest}/start'
  | '/v1/requests/{serviceRequest}/complete'
  | '/v1/requests/{serviceRequest}/confirm'
  | '/v1/requests/{serviceRequest}/cancel';

/**
 * One service request (REQ01–REQ03, ORD05): status banner, versioned quotes & agreed amount,
 * provider and customer actions, linked chat, photos, details, and status history.
 */
export function RequestView({ id }: { id: string }) {
  const { t } = useT('requests');
  const { t: tSync } = useT('sync');
  const language = useLanguage();
  const api = useApi();
  const queryClient = useQueryClient();
  const startConversation = useStartConversation();
  const { user } = useAccount();
  const live = useRealtimeConnected();

  const request = useServiceRequest(id);
  const copyAt = useOfflineCopy('service-request', id);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [staleNotice, setStaleNotice] = useState(false);
  const inFlight = useRef(false);
  const actionKey = useRef<{ signature: string; key: string } | null>(null);

  useUserEvents(user?.id, {
    'request.updated': (data) => {
      if ((data as { request_id?: string }).request_id === id) {
        void queryClient.invalidateQueries({ queryKey: requestKeys.request(id) });
      }
      void queryClient.invalidateQueries({ queryKey: requestKeys.all });
    },
  });

  const item = request.data;
  const active = item
    ? item.status === 'held' ||
      item.status === 'submitted' ||
      item.status === 'accepted' ||
      item.status === 'in_progress' ||
      item.status === 'completion_submitted'
    : false;

  useEffect(() => {
    if (!active) return;
    const timer = setInterval(() => void request.refetch(), live ? 60_000 : 15_000);
    return () => clearInterval(timer);
  }, [active, live, request]);

  function handleConflictOrError(e: unknown) {
    const apiError = e instanceof ApiRequestError ? e : null;
    const current = (apiError?.body as { data?: ServiceRequest } | null)?.data;
    if (current) {
      queryClient.setQueryData(requestKeys.request(id), current);
      void queryClient.invalidateQueries({ queryKey: requestKeys.all });
      if (apiError?.code === 'quote_superseded' || apiError?.code === 'quote_not_accepted' || apiError?.code === 'quote_already_accepted') {
        setError(t(errorKey(apiError.code)));
      } else {
        setStaleNotice(true);
      }
    } else {
      setError(
        apiError?.code === 'content_blocked'
          ? t('errors:content_blocked')
          : t(errorKey(apiError?.code ?? 'network_error')),
      );
    }
  }

  async function runAction(path: ActionPath, extra: { note?: string | null; reason?: string } = {}): Promise<boolean> {
    if (!item || inFlight.current) return false;
    const body = { version: item.version, ...extra };
    const signature = `${path}:${JSON.stringify(body)}`;
    if (actionKey.current?.signature !== signature) {
      actionKey.current = { signature, key: crypto.randomUUID() };
    }
    inFlight.current = true;
    setBusy(true);
    setError(null);
    setStaleNotice(false);
    try {
      const updated = unwrap(
        await api.POST(path, {
          params: { path: { serviceRequest: item.id } },
          body: body as never,
          headers: { 'Idempotency-Key': actionKey.current.key },
        }),
      ).data;
      queryClient.setQueryData(requestKeys.request(id), updated);
      void queryClient.invalidateQueries({ queryKey: requestKeys.all });
      return true;
    } catch (e) {
      handleConflictOrError(e);
      return false;
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  async function sendQuote(payload: { amount_kobo: number; scope: string; estimated_days: number | null }): Promise<boolean> {
    if (!item || inFlight.current) return false;
    const body = { version: item.version, ...payload };
    const signature = `sendQuote:${JSON.stringify(body)}`;
    if (actionKey.current?.signature !== signature) {
      actionKey.current = { signature, key: crypto.randomUUID() };
    }
    inFlight.current = true;
    setBusy(true);
    setError(null);
    setStaleNotice(false);
    try {
      const updated = unwrap(
        await api.POST('/v1/requests/{serviceRequest}/quotes', {
          params: { path: { serviceRequest: item.id } },
          body,
          headers: { 'Idempotency-Key': actionKey.current.key },
        }),
      ).data;
      queryClient.setQueryData(requestKeys.request(id), updated);
      void queryClient.invalidateQueries({ queryKey: requestKeys.all });
      return true;
    } catch (e) {
      handleConflictOrError(e);
      return false;
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  async function actOnQuote(quoteId: string, action: 'accept' | 'decline', note?: string | null): Promise<boolean> {
    if (!item || inFlight.current) return false;
    const path =
      action === 'accept'
        ? ('/v1/requests/{serviceRequest}/quotes/{quote}/accept' as const)
        : ('/v1/requests/{serviceRequest}/quotes/{quote}/decline' as const);
    const body = { version: item.version, ...(note !== undefined ? { note } : {}) };
    const signature = `${path}:${quoteId}:${JSON.stringify(body)}`;
    if (actionKey.current?.signature !== signature) {
      actionKey.current = { signature, key: crypto.randomUUID() };
    }
    inFlight.current = true;
    setBusy(true);
    setError(null);
    setStaleNotice(false);
    try {
      const updated = unwrap(
        await api.POST(path, {
          params: { path: { serviceRequest: item.id, quote: quoteId } },
          body,
          headers: { 'Idempotency-Key': actionKey.current.key },
        }),
      ).data;
      queryClient.setQueryData(requestKeys.request(id), updated);
      void queryClient.invalidateQueries({ queryKey: requestKeys.all });
      return true;
    } catch (e) {
      handleConflictOrError(e);
      return false;
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  async function openChat() {
    if (!item || inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setError(null);
    try {
      await startConversation({ type: 'service_request', id: item.id });
    } catch (e) {
      setError(t(errorKey(e instanceof ApiRequestError ? e.code : 'network_error')));
      inFlight.current = false;
      setBusy(false);
    }
  }

  if (request.isPending) {
    return (
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-4">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-56 w-full" />
      </div>
    );
  }

  if (request.isError || !item) {
    return (
      <p role="alert" className="mx-auto max-w-2xl rounded-lg bg-surface p-4 text-danger">
        {t('requestLoadFailed')}
      </p>
    );
  }

  const fmt = new Intl.DateTimeFormat(language === 'ig' ? 'ig-NG' : 'en-NG', { dateStyle: 'medium', timeStyle: 'short' });
  const dateFmt = new Intl.DateTimeFormat(language === 'ig' ? 'ig-NG' : 'en-NG', { dateStyle: 'medium' });
  const submittedMs = item.submitted_at ? Date.parse(item.submitted_at) : 0;
  const clientCreatedMs = item.client_created_at ? Date.parse(item.client_created_at) : 0;
  const showSeparateClientTime = Boolean(
    item.client_created_at && item.submitted_at && Math.abs(submittedMs - clientCreatedMs) > 60_000,
  );

  const galleryPhotos = item.photos.filter(
    (p): p is typeof p & { urls: { large: string; medium: string; thumb: string } } =>
      Boolean(p.urls.large && p.urls.medium && p.urls.thumb),
  );

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-5">
      <Link href={routes.requests(item.role === 'provider' ? 'received' : undefined)} className="text-sm font-semibold text-primary hover:underline">
        ← {t('allRequests')}
      </Link>

      {copyAt ? (
        <p role="status" className="text-sm font-semibold text-accent-text">
          {tSync('offlineCopy', { time: fmt.format(new Date(copyAt)) })}
        </p>
      ) : null}

      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{item.title}</h1>
          <p className="mt-0.5 text-sm text-text-muted">
            {t('requestNumber', { number: item.number })}
            {showSeparateClientTime && item.client_created_at
              ? ` · ${t('preparedOn', { date: fmt.format(new Date(item.client_created_at)) })} · ${t('submittedOn', { date: fmt.format(new Date(item.submitted_at)) })}`
              : item.submitted_at
                ? ` · ${t('sentOn', { date: fmt.format(new Date(item.submitted_at)) })}`
                : ''}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {item.agreed_amount_kobo !== null ? (
            <Badge tone="primary">{t('agreedAmount', { amount: formatNaira(item.agreed_amount_kobo) })}</Badge>
          ) : null}
          <RequestStatusBadge request={item} />
        </div>
      </header>

      {staleNotice ? (
        <p role="status" className="rounded-lg bg-accent-soft p-3 text-sm text-accent-text">
          {t('changedMeanwhile')}
        </p>
      ) : null}

      <StatusBanner request={item} />

      <QuotesSection request={item} busy={busy} onSendQuote={sendQuote} onActOnQuote={actOnQuote} />

      {item.role === 'provider' ? (
        <ProviderActions request={item} busy={busy} onAction={runAction} />
      ) : (
        <CustomerActions request={item} busy={busy} onAction={runAction} />
      )}

      {error ? (
        <p role="alert" className="rounded-lg bg-surface p-3 text-sm text-danger">
          {error}
        </p>
      ) : null}

      {galleryPhotos.length > 0 ? (
        <section className="flex flex-col gap-3 rounded-2xl border border-border p-4">
          <h2 className="font-bold">{t('photos')}</h2>
          <PhotoGallery photos={galleryPhotos} alt={item.title} />
        </section>
      ) : null}

      <section className="flex flex-col gap-4 rounded-2xl border border-border p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">
              {item.role === 'provider' ? t('customer') : t('provider')}
            </p>
            <p className="text-lg font-bold">{item.other_party.name}</p>
          </div>
          {item.status !== 'held' && item.status !== 'rejected' ? (
            <Button type="button" variant="secondary" disabled={busy} onClick={() => void openChat()}>
              {item.role === 'provider' ? t('messageCustomer') : t('messageProvider')}
            </Button>
          ) : null}
        </div>

        <div className="border-t border-border pt-3">
          <h2 className="mb-2 font-bold">{t('detailsTitle')}</h2>
          <p className="whitespace-pre-line text-sm leading-relaxed">{item.description}</p>
        </div>

        <dl className="flex flex-col gap-2 border-t border-border pt-3 text-sm">
          <Row label={t('category')} value={item.category.name} />
          <Row label={t('location')} value={item.location.name} />
          {item.preferred_date || item.preferred_time ? (
            <Row
              label={t('preferredTiming')}
              value={[
                item.preferred_date ? dateFmt.format(new Date(`${item.preferred_date}T00:00:00`)) : null,
                item.preferred_time ? t(`time.${item.preferred_time}`) : null,
              ]
                .filter(Boolean)
                .join(' · ')}
            />
          ) : null}
          {item.budget_min_kobo !== null || item.budget_max_kobo !== null ? (
            <Row
              label={t('budget')}
              value={
                item.budget_min_kobo !== null && item.budget_max_kobo !== null
                  ? `${formatNaira(item.budget_min_kobo)} – ${formatNaira(item.budget_max_kobo)}`
                  : item.budget_min_kobo !== null
                    ? formatNaira(item.budget_min_kobo)
                    : item.budget_max_kobo !== null
                      ? formatNaira(item.budget_max_kobo)
                      : ''
              }
            />
          ) : null}
          {item.agreed_amount_kobo !== null ? (
            <Row label={t('agreedLabel')} value={formatNaira(item.agreed_amount_kobo)} />
          ) : null}
        </dl>

        {item.listing ? (
          <Link href={routes.listing(item.listing)} className="text-sm font-semibold text-primary hover:underline">
            {t('viewListing')}: {item.listing.title}
          </Link>
        ) : item.profile ? (
          <Link href={routes.profile(item.profile)} className="text-sm font-semibold text-primary hover:underline">
            {t('viewProfile')}: {item.profile.display_name}
          </Link>
        ) : null}
      </section>

      {item.events && item.events.length > 0 ? (
        <section className="rounded-2xl border border-border p-4">
          <h2 className="mb-3 font-bold">{t('history')}</h2>
          <ol className="flex flex-col gap-3 text-sm">
            {item.events.map((event, i) => {
              const who = t(`by.${event.actor}`);
              return (
                <li key={`${event.to}-${event.at}-${i}`} className="flex flex-col gap-0.5">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <span className="font-medium">
                      {requestEventLabel(t, event)}
                      {who ? <span className="font-normal text-text-muted"> · {who}</span> : null}
                    </span>
                    <span className="text-xs text-text-muted">{fmt.format(new Date(event.at))}</span>
                  </div>
                  {event.note ? <p className="text-xs text-text-muted">“{event.note}”</p> : null}
                </li>
              );
            })}
          </ol>
        </section>
      ) : null}
    </div>
  );
}

function QuotesSection({
  request,
  busy,
  onSendQuote,
  onActOnQuote,
}: {
  request: ServiceRequest;
  busy: boolean;
  onSendQuote: (payload: { amount_kobo: number; scope: string; estimated_days: number | null }) => Promise<boolean>;
  onActOnQuote: (quoteId: string, action: 'accept' | 'decline', note?: string | null) => Promise<boolean>;
}) {
  const { t } = useT('requests');
  const latest = request.latest_quote;
  const quotes = request.quotes ?? [];
  const earlierQuotes = latest ? quotes.filter((q) => q.id !== latest.id) : [];

  const canProviderQuote =
    request.role === 'provider' &&
    request.accepted_quote_id === null &&
    (request.status === 'submitted' || request.status === 'accepted');

  // Open the quote form automatically when the provider hasn't sent a quote yet, or when the customer asked for a revision.
  const [editingQuote, setEditingQuote] = useState(false);
  const showQuoteForm =
    canProviderQuote && (latest === null || latest.status === 'rejected' || editingQuote);

  const [decliningQuote, setDecliningQuote] = useState(false);
  const [declineNote, setDeclineNote] = useState('');

  if (!latest && !canProviderQuote && request.agreed_amount_kobo === null) {
    return null;
  }

  return (
    <section className="flex flex-col gap-4 rounded-2xl border border-border p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-bold">{t('quoteTitle')}</h2>
        {latest ? (
          <Badge tone={latest.status === 'accepted' ? 'primary' : latest.status === 'sent' ? 'accent' : 'warning'}>
            {t('quoteVersion', { version: latest.version })} · {t(`quoteStatus.${latest.status}`)}
          </Badge>
        ) : null}
      </div>

      {latest ? (
        <div className="flex flex-col gap-2 rounded-xl bg-surface p-3.5">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <span className="text-xl font-extrabold text-primary">{formatNaira(latest.amount_kobo)}</span>
            {latest.estimated_days ? (
              <span className="text-xs font-semibold text-text-muted">
                {t('estimatedDays', { count: latest.estimated_days })}
              </span>
            ) : null}
          </div>
          <p className="whitespace-pre-line text-sm">{latest.scope}</p>
          {latest.rejection_note ? (
            <p className="mt-1 rounded-lg bg-background p-2.5 text-xs font-medium text-warning">
              {t('customerNote', { note: latest.rejection_note })}
            </p>
          ) : null}
        </div>
      ) : null}

      {request.role === 'customer' &&
      latest?.status === 'sent' &&
      request.accepted_quote_id === null &&
      (request.status === 'submitted' || request.status === 'accepted') ? (
        <div className="flex flex-col gap-3">
          <p className="text-sm text-text-muted">
            {t('customerQuoteWaiting', {
              provider: request.other_party.name,
              amount: formatNaira(latest.amount_kobo),
            })}
          </p>
          {decliningQuote ? (
            <div className="flex flex-col gap-3 rounded-xl border border-border p-3">
              <p className="font-semibold">{t('declineQuoteTitle')}</p>
              <p className="text-xs text-text-muted">{t('declineQuoteHint')}</p>
              <TextAreaField
                label={t('declineQuoteNoteLabel')}
                value={declineNote}
                onChange={(e) => setDeclineNote(e.target.value)}
                maxLength={300}
                rows={2}
              />
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  disabled={busy}
                  onClick={() =>
                    void onActOnQuote(latest.id, 'decline', declineNote.trim() || null).then((ok) => {
                      if (ok) {
                        setDecliningQuote(false);
                        setDeclineNote('');
                      }
                    })
                  }
                >
                  {t('confirmDeclineQuote')}
                </Button>
                <Button type="button" variant="ghost" disabled={busy} onClick={() => setDecliningQuote(false)}>
                  {t('cancelRevise')}
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              <Button type="button" disabled={busy} onClick={() => void onActOnQuote(latest.id, 'accept')}>
                {busy ? t('acceptingQuote') : t('acceptQuoteButton', { amount: formatNaira(latest.amount_kobo) })}
              </Button>
              <Button type="button" variant="secondary" disabled={busy} onClick={() => setDecliningQuote(true)}>
                {t('declineQuoteButton')}
              </Button>
            </div>
          )}
        </div>
      ) : null}

      {canProviderQuote && !showQuoteForm ? (
        <div>
          <Button type="button" variant="secondary" disabled={busy} onClick={() => setEditingQuote(true)}>
            {t('openReviseQuote')}
          </Button>
        </div>
      ) : null}

      {showQuoteForm ? (
        <QuoteEditor
          request={request}
          latest={latest}
          busy={busy}
          onCancel={latest && latest.status !== 'rejected' ? () => setEditingQuote(false) : undefined}
          onSubmit={async (payload) => {
            const ok = await onSendQuote(payload);
            if (ok) setEditingQuote(false);
            return ok;
          }}
        />
      ) : null}

      {earlierQuotes.length > 0 ? (
        <div className="border-t border-border pt-3">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-muted">{t('quotesHistory')}</p>
          <ul className="flex flex-col gap-2 text-sm">
            {earlierQuotes.map((q) => (
              <li key={q.id} className="flex flex-col gap-1 rounded-xl border border-border p-3 text-text-muted">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="font-semibold text-text">
                    {t('quoteVersion', { version: q.version })} · {formatNaira(q.amount_kobo)}
                  </span>
                  <span className="text-xs">{t(`quoteStatus.${q.status}`)}</span>
                </div>
                <p className="text-xs">{q.scope}</p>
                {q.rejection_note ? (
                  <p className="text-xs text-warning">{t('customerNote', { note: q.rejection_note })}</p>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}

function QuoteEditor({
  request,
  latest,
  busy,
  onCancel,
  onSubmit,
}: {
  request: ServiceRequest;
  latest: ServiceQuote | null;
  busy: boolean;
  onCancel?: () => void;
  onSubmit: (payload: { amount_kobo: number; scope: string; estimated_days: number | null }) => Promise<boolean>;
}) {
  const { t } = useT('requests');
  const nextVersion = (latest?.version ?? 0) + 1;
  const defaultAmount = latest
    ? koboToNaira(latest.amount_kobo)
    : request.budget_max_kobo
      ? koboToNaira(request.budget_max_kobo)
      : request.budget_min_kobo
        ? koboToNaira(request.budget_min_kobo)
        : '';

  const [amount, setAmount] = useState(defaultAmount);
  const [scope, setScope] = useState(latest?.scope ?? '');
  const [days, setDays] = useState(latest?.estimated_days ? String(latest.estimated_days) : '');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const parsedKobo = nairaToKobo(amount);
  const validAmount = parsedKobo !== null && !Number.isNaN(parsedKobo) && parsedKobo >= 100;

  function submit(event: FormEvent) {
    event.preventDefault();
    const problems: Record<string, string> = {};
    if (!validAmount || parsedKobo === null) {
      problems.amount = t('quoteAmountInvalid');
    }
    if (scope.trim().length < 5) {
      problems.scope = t('quoteScopeRequired');
    }
    const trimmedDays = days.trim();
    const parsedDays = trimmedDays === '' ? null : Number(trimmedDays);
    if (parsedDays !== null && (!Number.isInteger(parsedDays) || parsedDays < 1 || parsedDays > 365)) {
      problems.days = t('estimatedDaysInvalid');
    }
    setErrors(problems);
    if (Object.keys(problems).length > 0 || parsedKobo === null) return;

    void onSubmit({
      amount_kobo: parsedKobo,
      scope: scope.trim(),
      estimated_days: parsedDays,
    });
  }

  return (
    <form method="post" onSubmit={submit} className="flex flex-col gap-3 rounded-xl border border-border bg-background p-3.5" noValidate>
      <div>
        <h3 className="font-bold">
          {nextVersion === 1 ? t('sendQuoteTitle') : t('reviseQuoteTitle', { version: nextVersion })}
        </h3>
        <p className="mt-0.5 text-xs text-text-muted">{t('sendQuoteHint')}</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <TextField
          label={t('quoteAmountLabel')}
          inputMode="numeric"
          value={amount}
          onChange={(e) => {
            setAmount(e.target.value);
            setErrors((curr) => ({ ...curr, amount: '' }));
          }}
          error={errors.amount || undefined}
        />

        <TextField
          label={t('estimatedDaysLabel')}
          inputMode="numeric"
          value={days}
          onChange={(e) => {
            setDays(e.target.value);
            setErrors((curr) => ({ ...curr, days: '' }));
          }}
          error={errors.days || undefined}
        />
      </div>

      <TextAreaField
        label={t('quoteScopeLabel')}
        value={scope}
        onChange={(e) => {
          setScope(e.target.value);
          setErrors((curr) => ({ ...curr, scope: '' }));
        }}
        rows={3}
        maxLength={2000}
        hint={t('quoteScopeHint')}
        error={errors.scope || undefined}
      />

      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={busy}>
          {busy
            ? t('sendingQuote')
            : nextVersion === 1
              ? validAmount && parsedKobo !== null
                ? t('sendQuoteWithAmount', { amount: formatNaira(parsedKobo) })
                : t('sendQuoteButton')
              : validAmount && parsedKobo !== null
                ? t('sendRevisedQuoteWithAmount', { amount: formatNaira(parsedKobo), version: nextVersion })
                : t('sendRevisedQuoteButton')}
        </Button>
        {onCancel ? (
          <Button type="button" variant="ghost" disabled={busy} onClick={onCancel}>
            {t('cancelRevise')}
          </Button>
        ) : null}
      </div>
    </form>
  );
}

function StatusBanner({ request }: { request: ServiceRequest }) {
  const { t } = useT('requests');
  const status = request.status;
  const latest = request.latest_quote;

  if (status === 'held') {
    return (
      <section role="status" className="rounded-2xl bg-accent-soft p-4 text-sm text-accent-text">
        <p className="font-semibold">{t('heldBanner')}</p>
      </section>
    );
  }

  if (status === 'rejected') {
    return (
      <section role="alert" className="rounded-2xl bg-surface p-4 text-sm text-danger">
        <p className="font-semibold">{t('rejectedBanner', { reason: request.rejection_reason ?? '' })}</p>
      </section>
    );
  }

  if (request.role === 'provider') {
    const text =
      status === 'submitted'
        ? t('providerSubmittedBanner', { customer: request.other_party.name })
        : status === 'accepted'
          ? request.accepted_quote_id !== null && request.agreed_amount_kobo !== null && latest
            ? t('providerQuoteAccepted', {
                customer: request.other_party.name,
                amount: formatNaira(request.agreed_amount_kobo),
                version: latest.version,
              })
            : latest?.status === 'sent'
              ? t('providerQuoteWaiting', {
                  customer: request.other_party.name,
                  amount: formatNaira(latest.amount_kobo),
                  version: latest.version,
                })
              : latest?.status === 'rejected'
                ? t('providerQuoteRejected', {
                    customer: request.other_party.name,
                    amount: formatNaira(latest.amount_kobo),
                    version: latest.version,
                  })
                : t('providerAcceptedBanner')
          : status === 'in_progress'
            ? t('providerInProgressBanner')
            : status === 'completion_submitted'
              ? t('providerCompletionSubmittedBanner', { customer: request.other_party.name })
              : status === 'completed'
                ? t('providerCompletedBanner', { customer: request.other_party.name })
                : status === 'declined'
                  ? t('providerDeclinedBanner')
                  : status === 'cancelled'
                    ? t('providerCancelledBanner', { customer: request.other_party.name })
                    : null;
    if (!text) return null;
    return (
      <section role="status" className="rounded-2xl bg-primary-soft/50 p-4 text-sm">
        <p className="font-semibold">{text}</p>
      </section>
    );
  }

  const text =
    status === 'submitted'
      ? t('customerSubmittedBanner', { provider: request.other_party.name })
      : status === 'accepted'
        ? request.accepted_quote_id !== null && request.agreed_amount_kobo !== null && latest
          ? t('customerQuoteAccepted', {
              amount: formatNaira(request.agreed_amount_kobo),
              version: latest.version,
            })
          : latest?.status === 'sent'
            ? t('customerQuoteWaiting', {
                provider: request.other_party.name,
                amount: formatNaira(latest.amount_kobo),
              })
            : t('customerAcceptedBanner', { provider: request.other_party.name })
        : status === 'in_progress'
          ? t('customerInProgressBanner', { provider: request.other_party.name })
          : status === 'completion_submitted'
            ? t('customerCompletionSubmittedBanner', { provider: request.other_party.name })
            : status === 'completed'
              ? t('customerCompletedBanner')
              : status === 'declined'
                ? t('customerDeclinedBanner', { provider: request.other_party.name })
                : status === 'cancelled'
                  ? t('customerCancelledBanner')
                  : null;

  if (!text) return null;
  const tone = status === 'declined' || status === 'cancelled' ? 'bg-surface' : 'bg-primary-soft/50';
  return (
    <section role="status" className={`rounded-2xl ${tone} p-4 text-sm`}>
      <p className="font-semibold">{text}</p>
    </section>
  );
}

function ProviderActions({
  request,
  busy,
  onAction,
}: {
  request: ServiceRequest;
  busy: boolean;
  onAction: (path: ActionPath, extra?: { note?: string | null; reason?: string }) => Promise<boolean>;
}) {
  const { t } = useT('requests');
  const [declining, setDeclining] = useState(false);
  const [reason, setReason] = useState('');
  const [reasonError, setReasonError] = useState<string | null>(null);
  const [note, setNote] = useState('');

  if (request.status === 'submitted') {
    return (
      <section className="flex flex-col gap-3 rounded-2xl border border-border p-4">
        {declining ? (
          <div className="flex flex-col gap-3">
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
                type="button"
                variant="secondary"
                disabled={busy}
                onClick={() => {
                  if (reason.trim().length < 5) {
                    setReasonError(t('declineReasonRequired'));
                    return;
                  }
                  void onAction('/v1/requests/{serviceRequest}/decline', { reason: reason.trim() }).then((ok) => {
                    if (ok) setDeclining(false);
                  });
                }}
              >
                {t('confirmDecline')}
              </Button>
              <Button type="button" variant="ghost" disabled={busy} onClick={() => setDeclining(false)}>
                {t('keepRequest')}
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-text-muted">{t('acceptHint')}</p>
            <Button type="button" variant="ghost" disabled={busy} onClick={() => setDeclining(true)}>
              {t('decline')}
            </Button>
          </div>
        )}
      </section>
    );
  }

  if (request.status === 'accepted') {
    const canStart = request.accepted_quote_id !== null || request.quotes.length === 0;
    if (!canStart) return null;

    return (
      <section className="flex flex-col gap-3 rounded-2xl border border-border p-4">
        <Button type="button" disabled={busy} className="self-start" onClick={() => void onAction('/v1/requests/{serviceRequest}/start')}>
          {busy ? t('startingWork') : t('startWork')}
        </Button>
      </section>
    );
  }

  if (request.status === 'in_progress') {
    return (
      <section className="flex flex-col gap-3 rounded-2xl border border-border p-4">
        <TextAreaField
          label={t('noteLabel')}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          maxLength={300}
          rows={2}
          hint={t('noteHint')}
        />
        <Button
          type="button"
          disabled={busy}
          className="self-start"
          onClick={() =>
            void onAction('/v1/requests/{serviceRequest}/complete', { note: note.trim() || null }).then((ok) => {
              if (ok) setNote('');
            })
          }
        >
          {busy ? t('markingComplete') : t('markComplete')}
        </Button>
      </section>
    );
  }

  return null;
}

function CustomerActions({
  request,
  busy,
  onAction,
}: {
  request: ServiceRequest;
  busy: boolean;
  onAction: (path: ActionPath, extra?: { note?: string | null }) => Promise<boolean>;
}) {
  const { t } = useT('requests');
  const [confirming, setConfirming] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [cancelNote, setCancelNote] = useState('');

  const canConfirm = request.status === 'completion_submitted';
  const canCancel = request.status === 'held' || request.status === 'submitted' || request.status === 'accepted';

  if (!canConfirm && !canCancel) return null;

  return (
    <div className="flex flex-col gap-4">
      {canConfirm ? (
        <section className="flex flex-col gap-3 rounded-2xl border border-primary bg-primary-soft/30 p-4">
          <h2 className="font-bold">{t('confirmTitle')}</h2>
          <p className="text-sm">{t('confirmHint')}</p>
          {confirming ? (
            <div className="flex flex-col gap-2 rounded-xl bg-background p-3">
              <p className="font-semibold">{t('confirmQuestion', { provider: request.other_party.name })}</p>
              <div className="flex flex-wrap gap-2">
                <Button type="button" disabled={busy} onClick={() => void onAction('/v1/requests/{serviceRequest}/confirm')}>
                  {busy ? t('confirming') : t('confirmYes')}
                </Button>
                <Button type="button" variant="ghost" disabled={busy} onClick={() => setConfirming(false)}>
                  {t('notYet')}
                </Button>
              </div>
            </div>
          ) : (
            <Button type="button" disabled={busy} className="self-start" onClick={() => setConfirming(true)}>
              {t('confirmButton')}
            </Button>
          )}
        </section>
      ) : null}

      {canCancel ? (
        <section className="flex flex-col gap-3 rounded-2xl border border-border p-4">
          {cancelling ? (
            <div className="flex flex-col gap-3">
              <p className="font-semibold">{t('cancelQuestion')}</p>
              <TextAreaField
                label={t('cancelNoteLabel')}
                value={cancelNote}
                onChange={(e) => setCancelNote(e.target.value)}
                maxLength={300}
                rows={2}
              />
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  disabled={busy}
                  onClick={() =>
                    void onAction('/v1/requests/{serviceRequest}/cancel', { note: cancelNote.trim() || null }).then((ok) => {
                      if (ok) setCancelling(false);
                    })
                  }
                >
                  {busy ? t('cancelling') : t('cancelYes')}
                </Button>
                <Button type="button" variant="ghost" disabled={busy} onClick={() => setCancelling(false)}>
                  {t('keepRequest')}
                </Button>
              </div>
            </div>
          ) : (
            <Button type="button" variant="ghost" disabled={busy} className="self-start" onClick={() => setCancelling(true)}>
              {t('cancelRequest')}
            </Button>
          )}
        </section>
      ) : null}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="text-text-muted">{label}</dt>
      <dd className="text-right font-medium">{value}</dd>
    </div>
  );
}
