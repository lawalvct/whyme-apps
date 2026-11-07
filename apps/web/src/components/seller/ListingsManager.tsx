'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import { parseAsStringLiteral, useQueryState } from 'nuqs';
import { ensureOk, sellerKeys, unwrap, useApi, type OwnerListing } from '@whyme/data';
import { Price } from '@/components/market/Price';
import { Button, ButtonLink } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { routes } from '@/lib/format';
import { useLanguage, useT } from '@/lib/i18n';
import { useAccount } from '@/lib/session';
import { conflictRecord, Notice, PageTitle, sellerCapabilities, StatusBadge, StatusNote, useErrorText } from './common';
import { StartSelling } from './StartSelling';

const FILTERS = ['all', 'published', 'pending_review', 'draft', 'paused', 'rejected'] as const;

type Page = { items: OwnerListing[]; next: string | null };

function nextCursor(next: string | null | undefined): string | null {
  return next ? new URL(next).searchParams.get('cursor') : null;
}

/** The seller's listings by status, with publish, pause and delete (LST06, LST07). */
export function ListingsManager() {
  const { t } = useT('seller');
  const { t: tMarket } = useT('market');
  const api = useApi();
  const { user } = useAccount();
  const caps = sellerCapabilities(user);
  const [filter, setFilter] = useQueryState('status', parseAsStringLiteral(FILTERS).withDefault('all'));
  const [notice, setNotice] = useState<{ tone: 'success' | 'info' | 'error'; text: string } | null>(null);

  const listings = useInfiniteQuery({
    queryKey: sellerKeys.listings({ status: filter }),
    initialPageParam: null as string | null,
    getNextPageParam: (last: Page) => nextCursor(last.next),
    enabled: caps.vendor || caps.provider,
    queryFn: async ({ pageParam }): Promise<Page> => {
      // The cursor isn't in the generated query types.
      const query = { status: filter === 'all' ? undefined : filter, cursor: pageParam ?? undefined } as Record<string, unknown>;
      const body = unwrap(await api.GET('/v1/me/listings', { params: { query: query as never } }));
      return { items: body.data, next: body.links.next };
    },
  });

  if (!caps.vendor && !caps.provider) return <StartSelling />;

  const items = listings.data?.pages.flatMap((p) => p.items) ?? [];

  return (
    <div className="flex flex-col gap-5">
      <PageTitle
        title={t('navListings')}
        actions={
          <>
            {caps.vendor ? <ButtonLink href={routes.newListing('product')}>{t('addProduct')}</ButtonLink> : null}
            {caps.provider ? (
              <ButtonLink href={routes.newListing('service')} variant={caps.vendor ? 'secondary' : 'primary'}>
                {t('addService')}
              </ButtonLink>
            ) : null}
          </>
        }
      />

      <div role="group" aria-label={t('navListings')} className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
        {FILTERS.map((value) => (
          <button
            key={value}
            type="button"
            aria-pressed={filter === value}
            onClick={() => {
              setNotice(null);
              void setFilter(value === 'all' ? null : value);
            }}
            className="min-h-11 shrink-0 rounded-full border border-border px-4 text-sm font-medium text-text-muted aria-pressed:border-primary aria-pressed:bg-primary-soft aria-pressed:text-primary-pressed"
          >
            {value === 'all' ? t('all') : t(`status.${value}`)}
          </button>
        ))}
      </div>

      {notice ? <Notice tone={notice.tone}>{notice.text}</Notice> : null}

      {listings.isPending ? (
        <div className="flex flex-col gap-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-28 w-full" />
          ))}
        </div>
      ) : listings.isError ? (
        <Notice tone="error">{t('errors:network_error')}</Notice>
      ) : items.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border p-8 text-center text-text-muted">
          {filter === 'all' ? t('noListings') : t('noListingsFiltered')}
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {items.map((listing) => (
            <ListingRow key={listing.id} listing={listing} onNotice={setNotice} />
          ))}
        </ul>
      )}

      {listings.hasNextPage ? (
        <Button variant="secondary" className="self-center" disabled={listings.isFetchingNextPage} onClick={() => void listings.fetchNextPage()}>
          {listings.isFetchingNextPage ? t('common:loading') : tMarket('loadMore')}
        </Button>
      ) : null}
    </div>
  );
}

type Action = 'publish' | 'pause' | 'delete';

function ListingRow({
  listing,
  onNotice,
}: {
  listing: OwnerListing;
  onNotice: (notice: { tone: 'success' | 'info' | 'error'; text: string } | null) => void;
}) {
  const { t } = useT('seller');
  const language = useLanguage();
  const api = useApi();
  const queryClient = useQueryClient();
  const errorText = useErrorText();
  const [busy, setBusy] = useState<Action | null>(null);
  const cover = listing.photos[0]?.urls.thumb ?? null;
  const updated = listing.updated_at
    ? new Intl.DateTimeFormat(language === 'ig' ? 'ig-NG' : 'en-NG', { day: 'numeric', month: 'short', year: 'numeric' }).format(
        new Date(listing.updated_at),
      )
    : null;

  async function act(action: Action) {
    if (action === 'delete' && !window.confirm(t('deleteConfirm', { title: listing.title }))) return;
    onNotice(null);
    setBusy(action);
    try {
      const path = { params: { path: { listing: listing.id } } };
      if (action === 'delete') {
        ensureOk(await api.DELETE('/v1/me/listings/{listing}', path));
        queryClient.removeQueries({ queryKey: sellerKeys.listing(listing.id) });
        onNotice({ tone: 'success', text: t('deleted') });
      } else {
        const route = action === 'pause' ? '/v1/me/listings/{listing}/pause' : '/v1/me/listings/{listing}/submit';
        const saved = unwrap(await api.POST(route, { ...path, body: { version: listing.version } })).data;
        queryClient.setQueryData(sellerKeys.listing(saved.id), saved);
        onNotice({
          tone: 'success',
          text: action === 'pause' ? t('paused') : saved.status === 'published' ? t('submittedLive') : t('submittedReview'),
        });
      }
    } catch (e) {
      onNotice(conflictRecord(e) ? { tone: 'info', text: t('conflictReloaded') } : { tone: 'error', text: errorText(e) });
    } finally {
      setBusy(null);
      await queryClient.invalidateQueries({ queryKey: ['me', 'seller', 'listings'] });
    }
  }

  const canPublish = listing.status === 'draft' || listing.status === 'rejected' || listing.status === 'expired';

  return (
    <li className="flex flex-col gap-3 rounded-2xl border border-border p-3 sm:flex-row sm:items-start sm:p-4">
      <Link href={routes.editListing(listing.id)} className="flex min-w-0 flex-1 gap-3">
        <div className="relative size-20 shrink-0 overflow-hidden rounded-lg bg-surface sm:size-24">
          {cover ? (
            // Short-lived signed link to the seller's own private copy.
            // eslint-disable-next-line @next/next/no-img-element
            <img src={cover} alt="" className="size-full object-cover" />
          ) : null}
        </div>
        <div className="flex min-w-0 flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={listing.status} />
            <span className="text-xs text-text-muted">{listing.kind === 'product' ? t('market:products') : t('market:services')}</span>
          </div>
          <p className="truncate font-semibold text-text">{listing.title}</p>
          <Price kobo={listing.price_kobo} kind={listing.kind} className="text-sm font-semibold text-primary" />
          {listing.status === 'rejected' || listing.status === 'hidden' ? (
            <StatusNote status={listing.status} reason={listing.status_reason} />
          ) : updated ? (
            <p className="text-xs text-text-muted">{t('updatedOn', { date: updated })}</p>
          ) : null}
        </div>
      </Link>

      <div className="flex flex-wrap gap-2 sm:justify-end">
        {canPublish ? (
          <Button className="min-h-11 px-4 text-sm" disabled={busy !== null} onClick={() => void act('publish')}>
            {busy === 'publish' ? t('common:loading') : t('publish')}
          </Button>
        ) : null}
        {listing.status === 'paused' ? (
          <Button className="min-h-11 px-4 text-sm" disabled={busy !== null} onClick={() => void act('publish')}>
            {busy === 'publish' ? t('common:loading') : t('resume')}
          </Button>
        ) : null}
        <ButtonLink href={routes.editListing(listing.id)} variant="secondary" className="min-h-11 px-4 text-sm">
          {listing.status === 'pending_review' ? t('view') : t('edit')}
        </ButtonLink>
        {listing.status === 'published' ? (
          <>
            <ButtonLink href={routes.listing(listing)} variant="ghost" className="min-h-11 px-3 text-sm">
              {t('view')}
            </ButtonLink>
            <Button variant="secondary" className="min-h-11 px-4 text-sm" disabled={busy !== null} onClick={() => void act('pause')}>
              {busy === 'pause' ? t('common:loading') : t('pause')}
            </Button>
          </>
        ) : null}
        <Button variant="ghost" className="min-h-11 px-3 text-sm text-danger hover:bg-surface" disabled={busy !== null} onClick={() => void act('delete')}>
          {t('delete')}
        </Button>
      </div>
    </li>
  );
}
