'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { requestKeys, useOfflineCopy, useServiceRequests, type ServiceRequest } from '@whyme/data';
import { errorKey } from '@whyme/i18n';
import { Badge } from '@/components/ui/badge';
import { Button, ButtonLink, buttonClass } from '@/components/ui/button';
import { cn } from '@/components/ui/cn';
import { MarketplaceIcon as Icon } from '@/components/ui/MarketplaceIcon';
import { Skeleton } from '@/components/ui/skeleton';
import { formatNaira, routes } from '@/lib/format';
import { useLanguage, useT } from '@/lib/i18n';
import { useAccountRuntime } from '@/lib/offline';
import { useUserEvents } from '@/lib/realtime';
import { discardRequestDraft, useRequestDrafts, type RequestDraft } from '@/lib/request-queue';
import { useAccount } from '@/lib/session';
import { RequestStatusBadge } from './RequestStatus';

/**
 * What the user requested from providers, and what customers requested from them (REQ01–REQ03, OFF05, AT06).
 * Kept on the device for offline reading, and shows unsent requests queued offline at the top.
 */
export function RequestsList() {
  const { t } = useT('requests');
  const { t: tSync } = useT('sync');
  const language = useLanguage();
  const params = useSearchParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user } = useAccount();

  const role: 'customer' | 'provider' = params.get('tab') === 'received' ? 'provider' : 'customer';
  const requests = useServiceRequests(role);
  const drafts = useRequestDrafts();
  const copyAt = useOfflineCopy('service-requests', `${role}:all`);

  const queuedCustomerDrafts = role === 'customer' ? (drafts ?? []) : [];
  const draftCountKey = (drafts ?? []).map((d) => `${d.localId}:${d.status ?? 'done'}`).join(',');

  useEffect(() => {
    void queryClient.invalidateQueries({ queryKey: requestKeys.all });
  }, [draftCountKey, queryClient]);

  useUserEvents(user?.id, {
    'request.updated': () => void queryClient.invalidateQueries({ queryKey: requestKeys.all }),
  });

  function switchTab(next: 'customer' | 'provider') {
    router.replace(routes.requests(next === 'provider' ? 'received' : undefined));
  }

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-5 py-2 sm:gap-6">
      <header className="relative overflow-hidden rounded-3xl border border-border bg-linear-to-br from-primary-soft/55 via-background to-accent-soft/45 p-5 shadow-xs sm:p-7">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="max-w-xl">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-background/90 px-3 py-1 text-xs font-bold text-primary shadow-2xs">
              <Icon name="tools" className="size-3.5" />
              {t('requests')}
            </span>
            <h1 className="mt-2.5 text-2xl font-extrabold tracking-tight sm:text-3xl">{t('requestsTitle')}</h1>
            <p className="mt-1 text-sm leading-relaxed text-text-muted">{t('requestsIntro')}</p>
          </div>

          <div role="tablist" aria-label={t('viewRequests')} className="grid grid-cols-2 gap-1.5 rounded-2xl border border-border bg-background/90 p-1.5 shadow-2xs sm:w-auto">
            {(['customer', 'provider'] as const).map((tab) => {
              const active = role === tab;
              return (
                <button
                  key={tab}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => switchTab(tab)}
                  className={cn(
                    'min-h-11 rounded-xl px-5 text-sm font-bold transition-colors',
                    active ? 'bg-primary text-on-primary shadow-xs' : 'text-text-muted hover:bg-surface hover:text-text',
                  )}
                >
                  {t(tab === 'customer' ? 'requested' : 'received')}
                </button>
              );
            })}
          </div>
        </div>

        {copyAt ? (
          <p role="status" className="mt-4 inline-flex items-center gap-2 rounded-xl bg-accent-soft px-3 py-1.5 text-xs font-semibold text-accent-text">
            {tSync('offlineCopy', {
              time: new Intl.DateTimeFormat(language === 'ig' ? 'ig-NG' : 'en-NG', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(copyAt)),
            })}
          </p>
        ) : null}
      </header>

      {queuedCustomerDrafts.length > 0 ? (
        <ul className="flex flex-col gap-3">
          {queuedCustomerDrafts.map((draft) => (
            <QueuedRequestRow key={draft.localId} draft={draft} />
          ))}
        </ul>
      ) : null}

      {requests.isPending ? (
        <div className="flex flex-col gap-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-28 w-full rounded-2xl" />
          ))}
        </div>
      ) : requests.isError && queuedCustomerDrafts.length === 0 ? (
        <p role="alert" className="rounded-2xl border border-danger/30 bg-surface p-4 text-sm font-medium text-danger">
          {t('loadFailed')}
        </p>
      ) : (requests.data?.length ?? 0) === 0 && queuedCustomerDrafts.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-3xl border border-dashed border-border bg-surface/55 px-6 py-12 text-center sm:py-16">
          <span className="grid size-14 place-items-center rounded-2xl bg-primary-soft text-primary">
            <Icon name="tools" className="size-6" />
          </span>
          <h2 className="max-w-md text-lg font-extrabold tracking-tight">
            {t(role === 'provider' ? 'emptyReceivedTitle' : 'emptyRequestedTitle')}
          </h2>
          <p className="max-w-md text-sm leading-relaxed text-text-muted">
            {t(role === 'provider' ? 'emptyReceived' : 'emptyRequested')}
          </p>
          <ButtonLink href={routes.search({ type: 'service' })} variant="primary" className="mt-2 rounded-full px-5">
            {t('browseServices')}
          </ButtonLink>
        </div>
      ) : requests.data && requests.data.length > 0 ? (
        <ul className="flex flex-col gap-3">
          {requests.data.map((item) => (
            <RequestRow key={item.id} request={item} />
          ))}
        </ul>
      ) : null}

      <aside className="flex items-start gap-3 rounded-2xl border border-border bg-surface/65 p-4 text-xs leading-relaxed text-text-muted">
        <span className="grid size-8 shrink-0 place-items-center rounded-xl bg-primary-soft text-primary">
          <Icon name="shield" className="size-4" />
        </span>
        <p className="pt-0.5">{t('listSafety')}</p>
      </aside>
    </div>
  );
}

function QueuedRequestRow({ draft }: { draft: RequestDraft }) {
  const { t } = useT('requests');
  const { t: tSync } = useT('sync');
  const language = useLanguage();
  const sync = useAccountRuntime();

  const { payload } = draft;
  const createdTime = new Intl.DateTimeFormat(language === 'ig' ? 'ig-NG' : 'en-NG', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(payload.client_created_at));
  const budget = formatBudget(t, payload.budget_min_kobo, payload.budget_max_kobo);
  const refused = draft.status === 'rejected' || draft.status === 'photo_rejected';
  const errorMessage = draft.problem?.lastErrorCode ? t(errorKey(draft.problem.lastErrorCode)) : null;

  return (
    <li className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border-2 border-dashed border-accent bg-surface p-4 sm:p-5">
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={refused ? 'warning' : 'accent'}>
            {refused ? tSync('item.attention') : tSync('savedOffline')}
          </Badge>
          <span className="text-xs text-text-muted">
            {tSync('createdOffline', { time: createdTime })}
          </span>
        </div>

        <p className="truncate text-base font-bold text-text">{payload.title}</p>
        <p className="truncate text-xs text-text-muted">
          {payload.target_name ? `${payload.target_name} · ` : ''}
          {payload.location_name}
          {budget ? ` · ${budget}` : ''}
        </p>

        {errorMessage ? (
          <p role="alert" className="text-xs font-medium text-danger">{errorMessage}</p>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Link
          href={routes.newRequest({
            listing: payload.listing_id,
            profile: payload.profile_id,
            draft: draft.localId,
          })}
          className={buttonClass('secondary', 'min-h-9 px-3 text-xs')}
        >
          {t('editOfflineDraft')}
        </Link>
        {sync ? (
          <Button
            type="button"
            variant="ghost"
            className="min-h-9 px-3 text-xs text-danger"
            onClick={() => void discardRequestDraft(sync, draft.localId)}
          >
            {t('discardOfflineDraft')}
          </Button>
        ) : null}
      </div>
    </li>
  );
}

function formatBudget(t: (key: string, options?: Record<string, unknown>) => string, min: number | null, max: number | null): string | null {
  if (min !== null && max !== null) return t('budgetRange', { min: formatNaira(min), max: formatNaira(max) });
  if (min !== null) return t('budgetFrom', { min: formatNaira(min) });
  if (max !== null) return t('budgetUpTo', { max: formatNaira(max) });
  return null;
}

function RequestRow({ request }: { request: ServiceRequest }) {
  const { t } = useT('requests');
  const language = useLanguage();
  const fmt = new Intl.DateTimeFormat(language === 'ig' ? 'ig-NG' : 'en-NG', { dateStyle: 'medium', timeStyle: 'short' });
  const sentDate = request.submitted_at ? fmt.format(new Date(request.submitted_at)) : '';
  const preparedDate =
    request.client_created_at &&
    request.submitted_at &&
    Math.abs(new Date(request.submitted_at).getTime() - new Date(request.client_created_at).getTime()) > 60_000
      ? fmt.format(new Date(request.client_created_at))
      : '';
  const budget =
    request.agreed_amount_kobo !== null
      ? t('agreedAmount', { amount: formatNaira(request.agreed_amount_kobo) })
      : request.latest_quote
        ? t('quotedAmount', { amount: formatNaira(request.latest_quote.amount_kobo) })
        : formatBudget(t, request.budget_min_kobo, request.budget_max_kobo);
  const thumb = request.photos[0]?.urls.thumb ?? null;

  return (
    <li>
      <Link
        href={routes.request(request.id)}
        className="group flex items-center gap-4 rounded-2xl border border-border bg-background p-4 shadow-2xs transition hover:border-primary hover:shadow-sm focus-visible:outline-2 focus-visible:outline-primary sm:p-5"
      >
        <div className="grid size-16 shrink-0 place-items-center overflow-hidden rounded-xl border border-border bg-surface text-primary sm:size-20">
          {thumb ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={thumb} alt="" className="size-full object-cover transition duration-300 group-hover:scale-105" />
          ) : (
            <Icon name="tools" className="size-6" />
          )}
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="truncate text-base font-bold text-text group-hover:text-primary">{request.title}</p>
            {budget ? <span className="shrink-0 text-sm font-extrabold text-primary">{budget}</span> : null}
          </div>
          <p className="truncate text-xs text-text-muted">
            {t('requestNumber', { number: request.number })} · {request.other_party.name} · {request.location.name}
            {preparedDate ? ` · ${t('preparedOn', { date: preparedDate })}` : ''}
            {sentDate ? ` · ${t('sentOn', { date: sentDate })}` : ''}
          </p>
          <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
            <RequestStatusBadge request={request} />
          </div>
        </div>
        <span className="hidden size-9 shrink-0 place-items-center rounded-full bg-surface text-text-muted transition group-hover:bg-primary-soft group-hover:text-primary sm:grid">
          <Icon name="arrow" className="size-4" />
        </span>
      </Link>
    </li>
  );
}
