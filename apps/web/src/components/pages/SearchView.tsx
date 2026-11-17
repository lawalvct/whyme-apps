'use client';

import Link from 'next/link';
import { useRef, useState, type ReactNode } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import { parseAsInteger, parseAsString, parseAsStringLiteral, useQueryStates } from 'nuqs';
import { categoryLabel, isConnectionError, unwrap, useApi, useSyncStatus, useTaxonomy, type PublicListing, type PublicProfile } from '@whyme/data';
import { Skeleton } from '@/components/ui/skeleton';
import { MarketplaceIcon as Icon } from '@/components/ui/MarketplaceIcon';
import { formatNaira, routes } from '@/lib/format';
import { useLanguage, useT } from '@/lib/i18n';
import { searchKept, useKeptListings } from '@/lib/recent';
import { SearchFilters, type SearchFilterPatch } from './SearchFilters';
import { SearchListingCard, SearchProfileCard } from './SearchResultCard';
import styles from './SearchView.module.css';

const searchParams = {
  q: parseAsString.withDefault(''),
  type: parseAsStringLiteral(['offers', 'people'] as const).withDefault('offers'),
  kind: parseAsString,
  category_id: parseAsInteger,
  location_id: parseAsInteger,
  // Shareable shop URLs use whole naira; the API expects integer kobo.
  min_price: parseAsInteger,
  max_price: parseAsInteger,
};

type Filters = { kind?: string; category_id?: number; location_id?: number; min_price?: number; max_price?: number };
type Page =
  | { type: 'offers'; items: PublicListing[]; next: string | null; categories: { id: number; slug: string }[]; sponsored?: PublicListing[] }
  | { type: 'people'; items: PublicProfile[]; next: string | null; categories: { id: number; slug: string }[] };

function nextParam(next: string | null | undefined): string | null {
  if (!next) return null;
  const url = new URL(next, 'http://localhost');
  return url.searchParams.get('cursor') ?? url.searchParams.get('page');
}

function validPrice(value: number | null) {
  return value !== null && Number.isSafeInteger(value) && value >= 0 && value <= 1_000_000_000_000 ? value : null;
}

/** Public catalogue filters run on the API across all pages; view mode is local. */
export function SearchView() {
  const { t } = useT('market');
  const language = useLanguage();
  const api = useApi();
  const online = useSyncStatus((s) => s.online);
  const { data: taxonomy, isError: taxonomyError, refetch: refetchTaxonomy } = useTaxonomy();
  const [state, setState] = useQueryStates(searchParams, { history: 'push' });
  const [view, setView] = useState<'grid' | 'list'>('grid');
  const dialog = useRef<HTMLDialogElement>(null);
  const q = state.q.trim().slice(0, 100);
  const kinds = state.type === 'offers' ? (['product', 'service'] as const) : (['business', 'provider'] as const);
  const kind = kinds.find((value) => value === state.kind);
  const minPrice = state.type === 'offers' ? validPrice(state.min_price) : null;
  const maxPrice = state.type === 'offers' ? validPrice(state.max_price) : null;
  const filters: Filters = {
    kind,
    category_id: state.category_id ?? undefined,
    location_id: state.location_id ?? undefined,
    ...(state.type === 'offers' ? { min_price: minPrice === null ? undefined : minPrice * 100, max_price: maxPrice === null ? undefined : maxPrice * 100 } : {}),
  };

  const results = useInfiniteQuery({
    queryKey: ['search', state.type, q, filters],
    initialPageParam: null as string | null,
    getNextPageParam: (last: Page) => nextParam(last.next),
    enabled: online && q.length !== 1,
    queryFn: async ({ pageParam }): Promise<Page> => {
      const page = pageParam ? Number(pageParam) : undefined;
      if (state.type === 'offers') {
        const kindFilter = filters.kind as 'product' | 'service' | undefined;
        if (q.length >= 2) {
          const body = unwrap(await api.GET('/v1/search/listings', { params: { query: { q, ...filters, kind: kindFilter, page } } }));
          // Featured listings come in their own slot, never mixed into the ranked results (MON05).
          return { type: 'offers', items: body.data, next: body.links.next, categories: body.categories, sponsored: body.sponsored as PublicListing[] };
        }
        // Cursor is omitted from the generated browse request type.
        const query = { ...filters, kind: kindFilter, cursor: pageParam ?? undefined };
        const body = unwrap(await api.GET('/v1/listings', { params: { query: query as never } }));
        return { type: 'offers', items: body.data, next: body.links?.next ?? null, categories: [] };
      }
      const kindFilter = filters.kind as 'business' | 'provider' | undefined;
      const profileFilters = { kind: kindFilter, category_id: filters.category_id, location_id: filters.location_id };
      if (q.length >= 2) {
        const body = unwrap(await api.GET('/v1/search/profiles', { params: { query: { q, ...profileFilters, page } } }));
        return { type: 'people', items: body.data, next: body.links.next, categories: body.categories };
      }
      const query = { ...profileFilters, cursor: pageParam ?? undefined };
      const body = unwrap(await api.GET('/v1/profiles', { params: { query: query as never } }));
      return { type: 'people', items: body.data, next: body.links?.next ?? null, categories: [] };
    },
  });

  // Offline: search what this device keeps (saved and recently viewed listings), clearly labelled.
  const offline = !online || (results.isError && isConnectionError(results.error));
  const kept = useKeptListings();
  const keptMatches =
    offline && state.type === 'offers' && kept
      ? searchKept(kept, { q, kind: kind as 'product' | 'service' | undefined, category_id: filters.category_id, location_id: filters.location_id, min_price: filters.min_price, max_price: filters.max_price }, taxonomy)
      : [];
  const pages = offline ? [] : (results.data?.pages ?? []);
  const items = offline ? keptMatches : pages.flatMap((page): Array<PublicListing | PublicProfile> => page.items);
  const suggested = pages[0]?.categories ?? [];
  const firstPage = pages[0];
  const sponsored = firstPage?.type === 'offers' ? (firstPage.sponsored ?? []) : [];
  const activeCount = Number(Boolean(kind)) + Number(state.category_id !== null) + Number(state.location_id !== null) + Number(minPrice !== null || maxPrice !== null);
  const resetPatch = { kind: null, category_id: null, location_id: null, min_price: null, max_price: null };
  const updateFilters = (patch: SearchFilterPatch) => { void setState(patch); };
  const clearFilters = () => { void setState(resetPatch); };
  const clearAll = () => { void setState({ ...resetPatch, q: null }); };
  const category = taxonomy?.categories.find((value) => value.id === state.category_id);
  const location = taxonomy?.locations.find((value) => value.id === state.location_id);
  const chips: { key: string; label: string; remove: () => void }[] = [];
  if (q) chips.push({ key: 'q', label: q, remove: () => updateFilters({ q: null }) });
  if (kind) chips.push({ key: 'kind', label: t({ product: 'products', service: 'services', business: 'businesses', provider: 'providers' }[kind]), remove: () => updateFilters({ kind: null, category_id: null }) });
  if (state.category_id !== null) chips.push({ key: 'category', label: categoryLabel(category, language) ?? t('category'), remove: () => updateFilters({ category_id: null }) });
  if (state.location_id !== null) chips.push({ key: 'location', label: location?.name ?? t('location'), remove: () => updateFilters({ location_id: null }) });
  if (minPrice !== null || maxPrice !== null) chips.push({ key: 'price', label: minPrice !== null && maxPrice !== null ? `${formatNaira(minPrice * 100)} – ${formatNaira(maxPrice * 100)}` : minPrice !== null ? t('searchPriceFrom', { price: formatNaira(minPrice * 100) }) : t('searchPriceUpTo', { price: formatNaira(maxPrice! * 100) }), remove: () => updateFilters({ min_price: null, max_price: null }) });
  const filterProps = { type: state.type, kind: kind ?? null, q, categoryId: state.category_id, locationId: state.location_id, minPrice, maxPrice, taxonomy, taxonomyError, retryTaxonomy: () => { void refetchTaxonomy(); }, onChange: updateFilters };
  const loading = results.isPending && online && q.length !== 1;

  return (
    <div className={styles.page}>
      <nav className={styles.breadcrumb} aria-label={t('searchBreadcrumb')}><Link href={routes.home}>{t('home')}</Link><Icon name="chevron" /><span>{t('searchMarketplace')}</span></nav>
      <header className={styles.pageHeader}>
        <div><span className={styles.eyebrow}>{t('searchEyebrow')}</span><h1>{q ? t('resultsFor', { q }) : t('searchPageTitle')}</h1><p>{t('searchPageDescription')}</p></div>
        <a href="#marketplace-safety" className={styles.headerTrust}><span><Icon name="shield" /></span><div><strong>{t('shopWithConfidence')}</strong><small>{t('searchProtectionHint')}</small></div><Icon name="arrow" /></a>
      </header>

      <div className={styles.browseModes} role="group" aria-label={t('searchBrowseMode')}>
        {(['offers', 'people'] as const).map((type) => <button key={type} type="button" aria-pressed={state.type === type} onClick={() => void setState({ type, kind: null, category_id: null, min_price: null, max_price: null })}><Icon name={type === 'offers' ? 'bag' : 'shop'} /><span>{t(type === 'offers' ? 'searchShopOffers' : 'searchMeetPeople')}</span><Icon name="arrow" /></button>)}
      </div>

      <div className={styles.shopLayout}>
        <aside className={styles.sidebar} aria-label={t('searchFilters')}>
          <div className={styles.filterHeading}><h2><Icon name="filter" />{t('searchFilters')}</h2><button type="button" disabled={!activeCount} onClick={clearFilters}>{t('searchReset')}</button></div>
          <SearchFilters {...filterProps} />
          <div className={styles.sidebarNote}><Icon name="shield" /><h3>{t('searchSidebarTrustTitle')}</h3><p>{t('searchSidebarTrustBody')}</p><a href="#marketplace-safety">{t('searchSafetyTips')}<Icon name="arrow" /></a></div>
        </aside>

        <section className={styles.results} aria-label={t('results')}>
          <div className={styles.resultsToolbar}>
            <div className={styles.resultsSummary} role="status" aria-live="polite"><h2>{loading ? t('common:loading') : t(results.hasNextPage ? 'searchLoadedCount' : 'searchResultCount', { count: q.length === 1 ? 0 : items.length })}</h2><span>{t(q.length >= 2 ? 'searchRelevantFirst' : 'searchNewestFirst')}</span></div>
            <div className={styles.toolbarActions}><button type="button" className={styles.mobileFilters} onClick={() => dialog.current?.showModal()}><Icon name="filter" />{t('searchFilters')}{activeCount > 0 && <span>{activeCount}</span>}</button><div className={styles.viewToggle} role="group" aria-label={t('searchDisplayMode')}><button type="button" aria-label={t('searchGridView')} aria-pressed={view === 'grid'} onClick={() => setView('grid')}><Icon name="grid" /></button><button type="button" aria-label={t('searchListView')} aria-pressed={view === 'list'} onClick={() => setView('list')}><Icon name="list" /></button></div></div>
          </div>

          {chips.length > 0 && <div className={styles.activeFilters} aria-label={t('searchActiveFilters')}>{chips.map((chip) => <button type="button" key={chip.key} onClick={chip.remove} aria-label={t('searchRemoveFilter', { filter: chip.label })}><span>{chip.label}</span><Icon name="close" /></button>)}<button type="button" className={styles.clearAll} onClick={clearAll}>{t('searchClearAll')}</button></div>}

          {suggested.length > 0 && <div className={styles.suggestions}><span>{t('matchingCategories')}:</span>{suggested.map((value) => <button key={value.id} type="button" onClick={() => updateFilters({ category_id: value.id })}>{categoryLabel(taxonomy?.categories.find((category) => category.id === value.id), language) ?? value.slug}<Icon name="arrow" /></button>)}</div>}
          {!offline && sponsored.length > 0 && (
            <section aria-label={t('sponsored')} className="mb-6 flex flex-col gap-3 rounded-2xl border border-border bg-accent-soft p-3">
              <div className="flex flex-wrap items-baseline gap-2"><h3 className="text-sm font-bold uppercase tracking-wide text-accent-text">{t('sponsored')}</h3><p className="text-xs text-text-muted">{t('sponsoredHint')}</p></div>
              <div className={styles.resultsGrid} data-layout={view} data-type="offers">{sponsored.map((listing) => <SearchListingCard key={`sponsored-${listing.id}`} listing={listing} list={view === 'list'} />)}</div>
            </section>
          )}

          {offline ? <OfflineResults type={state.type} kept={kept} matches={keptMatches} view={view} />
            : q.length === 1 ? <SearchMessage icon="search" title={t('searchKeepTyping')} body={t('searchMinimumQuery')} />
            : loading ? <div className={styles.resultsGrid} data-layout={view} data-type={state.type}>{Array.from({ length: 6 }, (_, index) => <Skeleton key={index} className={state.type === 'people' ? 'h-60' : 'h-96'} />)}</div>
            : results.isError ? <SearchMessage icon="globe" title={t('errorTitle')} body={t('errorBody')}><button type="button" className={styles.primaryButton} disabled={results.isFetching} onClick={() => void results.refetch()}>{t('common:retry')}</button></SearchMessage>
            : items.length === 0 ? <SearchMessage icon="search" title={t('noResults')} body={t('noResultsHint')}><button type="button" className={styles.primaryButton} onClick={clearAll}>{t('searchResetBrowse')}<Icon name="arrow" /></button></SearchMessage>
            : <div className={styles.resultsGrid} data-layout={view} data-type={state.type} aria-busy={results.isFetchingNextPage}>{state.type === 'offers' ? (items as PublicListing[]).map((listing) => <SearchListingCard key={listing.id} listing={listing} list={view === 'list'} />) : (items as PublicProfile[]).map((profile) => <SearchProfileCard key={profile.id} profile={profile} />)}</div>}

          {items.length > 0 && !offline && q.length !== 1 && !results.isError && <div className={styles.resultsEnd}>{results.hasNextPage ? <button type="button" className={styles.loadMore} disabled={results.isFetchingNextPage} onClick={() => void results.fetchNextPage()}>{t(results.isFetchingNextPage ? 'common:loading' : 'loadMore')}<Icon name="plus" /></button> : <span>{t('searchEndOfResults')}</span>}</div>}
        </section>
      </div>

      <dialog ref={dialog} className={styles.filterDialog} aria-labelledby="mobile-filter-title" onClick={(event) => { if (event.target === event.currentTarget) dialog.current?.close(); }}>
        <div className={styles.dialogContent}><div className={styles.dialogHeading}><h2 id="mobile-filter-title"><Icon name="filter" />{t('searchFilters')}</h2><button type="button" aria-label={t('searchCloseFilters')} onClick={() => dialog.current?.close()}><Icon name="close" /></button></div><div className={styles.dialogBody}><SearchFilters {...filterProps} /></div><div className={styles.dialogFooter}><button type="button" className={styles.dialogReset} disabled={!activeCount} onClick={clearFilters}>{t('searchReset')}</button><button type="button" className={styles.primaryButton} onClick={() => dialog.current?.close()}>{t('searchShowResults')}<Icon name="arrow" /></button></div></div>
      </dialog>
    </div>
  );
}

/** Results from this device while offline: saved and recently viewed listings only. */
function OfflineResults({ type, kept, matches, view }: { type: 'offers' | 'people'; kept: PublicListing[] | undefined; matches: PublicListing[]; view: 'grid' | 'list' }) {
  const { t } = useT('market');
  if (type === 'people') return <SearchMessage icon="globe" title={t('offlineSearchTitle')} body={t('offlineSearchPeople')} />;
  // Signed out or nothing kept yet: nothing to search on this device.
  if (!kept?.length) return <SearchMessage icon="globe" title={t('searchOfflineTitle')} body={t('onlineOnly')} />;
  return (
    <>
      <p role="status" className="mb-4 rounded-lg bg-surface p-3 text-sm font-semibold text-accent-text">
        {t('offlineSearchTitle')}. {t('offlineSearchBody')}
      </p>
      {matches.length === 0 ? (
        <SearchMessage icon="search" title={t('noResults')} body={t('offlineSearchEmpty')} />
      ) : (
        <div className={styles.resultsGrid} data-layout={view} data-type="offers">
          {matches.map((listing) => <SearchListingCard key={listing.id} listing={listing} list={view === 'list'} />)}
        </div>
      )}
    </>
  );
}

function SearchMessage({ icon, title, body, children }: { icon: 'search' | 'globe'; title: string; body: string; children?: ReactNode }) {
  return <div className={styles.message} role="status"><span><Icon name={icon} /></span><h3>{title}</h3><p>{body}</p>{children}</div>;
}
