'use client';

import Link from 'next/link';
import { useInfiniteQuery } from '@tanstack/react-query';
import { parseAsInteger, parseAsString, parseAsStringLiteral, useQueryStates } from 'nuqs';
import { categoryLabel, unwrap, useApi, useSyncStatus, useTaxonomy, type PublicListing, type PublicProfile } from '@whyme/data';
import { Button } from '@/components/ui/button';
import { cn } from '@/components/ui/cn';
import { Skeleton } from '@/components/ui/skeleton';
import { CardGrid } from '@/components/market/CardGrid';
import { ListingCard } from '@/components/market/ListingCard';
import { ProfileCard } from '@/components/market/ProfileCard';
import { routes } from '@/lib/format';
import { useLanguage, useT } from '@/lib/i18n';

const searchParams = {
  q: parseAsString.withDefault(''),
  type: parseAsStringLiteral(['offers', 'people'] as const).withDefault('offers'),
  kind: parseAsString,
  category_id: parseAsInteger,
  location_id: parseAsInteger,
};

type Filters = { kind?: string; category_id?: number; location_id?: number };
type Page =
  | { type: 'offers'; items: PublicListing[]; next: string | null; categories: { id: number; slug: string }[] }
  | { type: 'people'; items: PublicProfile[]; next: string | null; categories: { id: number; slug: string }[] };

/** The `page` (search) or `cursor` (browse) value from the API's `links.next`. */
function nextParam(next: string | null | undefined): string | null {
  if (!next) return null;
  const url = new URL(next);
  return url.searchParams.get('cursor') ?? url.searchParams.get('page');
}

/**
 * Search and browse (LST02, UX05). Filters live in the URL (nuqs), so results
 * can be shared. With words it uses keyword search (most relevant first);
 * without, it lists the newest. Online only (OFF02).
 */
export function SearchView() {
  const { t } = useT('market');
  const api = useApi();
  const online = useSyncStatus((s) => s.online);
  const [state, setState] = useQueryStates(searchParams);
  const q = state.q.trim();
  const kinds = state.type === 'offers' ? (['product', 'service'] as const) : (['business', 'provider'] as const);
  const kind = kinds.find((k) => k === state.kind);
  const filters: Filters = {
    kind,
    category_id: state.category_id ?? undefined,
    location_id: state.location_id ?? undefined,
  };

  const results = useInfiniteQuery({
    queryKey: ['search', state.type, q, filters],
    initialPageParam: null as string | null,
    getNextPageParam: (last: Page) => nextParam(last.next),
    enabled: online,
    queryFn: async ({ pageParam }): Promise<Page> => {
      const page = pageParam ? Number(pageParam) : undefined;
      if (state.type === 'offers') {
        const kindFilter = filters.kind as 'product' | 'service' | undefined;
        if (q.length >= 2) {
          const body = unwrap(await api.GET('/v1/search/listings', { params: { query: { q, ...filters, kind: kindFilter, page } } }));
          return { type: 'offers', items: body.data, next: body.links.next, categories: body.categories };
        }
        // Browse pages by cursor, which the generated types don't list.
        const query = { ...filters, kind: kindFilter, cursor: pageParam ?? undefined } as Record<string, unknown>;
        const body = unwrap(await api.GET('/v1/listings', { params: { query: query as never } }));
        return { type: 'offers', items: body.data, next: body.links?.next ?? null, categories: [] };
      }
      const kindFilter = filters.kind as 'business' | 'provider' | undefined;
      if (q.length >= 2) {
        const body = unwrap(await api.GET('/v1/search/profiles', { params: { query: { q, ...filters, kind: kindFilter, page } } }));
        return { type: 'people', items: body.data, next: body.links.next, categories: body.categories };
      }
      const query = { ...filters, kind: kindFilter, cursor: pageParam ?? undefined } as Record<string, unknown>;
      const body = unwrap(await api.GET('/v1/profiles', { params: { query: query as never } }));
      return { type: 'people', items: body.data, next: body.links?.next ?? null, categories: [] };
    },
  });

  const pages = results.data?.pages ?? [];
  const items = pages.flatMap((p): Array<PublicListing | PublicProfile> => p.items);
  const suggested = pages[0]?.categories ?? [];

  return (
    <div className="flex flex-col gap-5">
      <h1 className="text-2xl font-bold">{q ? t('resultsFor', { q }) : t('browseTitle')}</h1>

      <div role="tablist" className="flex gap-2 border-b border-border">
        {(['offers', 'people'] as const).map((type) => (
          <button
            key={type}
            role="tab"
            type="button"
            aria-selected={state.type === type}
            onClick={() => void setState({ type, kind: null, category_id: null })}
            className={cn(
              '-mb-px min-h-11 border-b-2 px-3 font-semibold',
              state.type === type ? 'border-primary text-primary' : 'border-transparent text-text-muted hover:text-text',
            )}
          >
            {t(type)}
          </button>
        ))}
      </div>

      <Filters
        type={state.type}
        kinds={kinds}
        kind={kind ?? null}
        categoryId={state.category_id}
        locationId={state.location_id}
        onChange={(patch) => void setState(patch)}
      />

      {suggested.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-text-muted">{t('matchingCategories')}:</span>
          {suggested.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => void setState({ category_id: c.id })}
              className="rounded-full border border-border px-3 py-1 hover:border-primary hover:text-primary"
            >
              <SuggestedCategory id={c.id} slug={c.slug} />
            </button>
          ))}
        </div>
      ) : null}

      {!online ? (
        <p role="status" className="rounded-lg bg-surface p-4 text-text-muted">
          {t('onlineOnly')}
        </p>
      ) : results.isPending ? (
        <ResultsSkeleton people={state.type === 'people'} />
      ) : results.isError ? (
        <div className="flex flex-col items-start gap-3 rounded-lg bg-surface p-4">
          <p>{t('errorBody')}</p>
          <Button variant="secondary" onClick={() => void results.refetch()}>
            {t('common:retry')}
          </Button>
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-lg bg-surface p-6">
          <p className="font-semibold">{t('noResults')}</p>
          <p className="mt-1 text-text-muted">{t('noResultsHint')}</p>
          <Link href={routes.search({ type: state.type })} className="mt-3 inline-block font-semibold text-primary hover:underline">
            {t('browseTitle')}
          </Link>
        </div>
      ) : state.type === 'offers' ? (
        <CardGrid>
          {(items as PublicListing[]).map((listing) => (
            <ListingCard key={listing.id} listing={listing} />
          ))}
        </CardGrid>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {(items as PublicProfile[]).map((profile) => (
            <ProfileCard key={profile.id} profile={profile} />
          ))}
        </div>
      )}

      {results.hasNextPage ? (
        <Button variant="secondary" className="self-center" disabled={results.isFetchingNextPage} onClick={() => void results.fetchNextPage()}>
          {results.isFetchingNextPage ? t('common:loading') : t('loadMore')}
        </Button>
      ) : null}
    </div>
  );
}

function SuggestedCategory({ id, slug }: { id: number; slug: string }) {
  const language = useLanguage();
  const { data } = useTaxonomy();
  return <>{categoryLabel(data?.categories.find((c) => c.id === id), language) ?? slug}</>;
}

function Filters({
  type,
  kinds,
  kind,
  categoryId,
  locationId,
  onChange,
}: {
  type: 'offers' | 'people';
  kinds: readonly string[];
  kind: string | null;
  categoryId: number | null;
  locationId: number | null;
  onChange: (patch: { kind?: string | null; category_id?: number | null; location_id?: number | null }) => void;
}) {
  const { t } = useT('market');
  const language = useLanguage();
  const { data: taxonomy } = useTaxonomy();

  // Products and businesses use product categories; services and providers use service ones.
  const categoryTypes = kind === 'product' || kind === 'business' ? ['product'] : kind ? ['service'] : ['product', 'service'];
  const categories = (taxonomy?.categories ?? []).filter((c) => categoryTypes.includes(c.type));
  const areas = (taxonomy?.locations ?? []).filter((l) => l.type !== 'state');
  const selectClass = 'min-h-11 rounded-lg border border-border bg-background px-3 text-sm focus:border-primary focus:outline-2 focus:outline-primary-soft';

  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="flex rounded-lg border border-border p-0.5" role="group">
        {[null, ...kinds].map((value) => (
          <button
            key={value ?? 'all'}
            type="button"
            aria-pressed={kind === value}
            onClick={() => onChange({ kind: value, category_id: null })}
            className="min-h-10 rounded-md px-3 text-sm font-medium text-text-muted aria-pressed:bg-primary-soft aria-pressed:text-primary-pressed"
          >
            {value === null
              ? t(type === 'offers' ? 'offers' : 'people')
              : t({ product: 'products', service: 'services', business: 'businesses', provider: 'providers' }[value] ?? value)}
          </button>
        ))}
      </div>

      <label className="flex flex-col gap-1 text-sm font-medium">
        {t('category')}
        <select
          className={selectClass}
          value={categoryId ?? ''}
          onChange={(e) => onChange({ category_id: e.target.value ? Number(e.target.value) : null })}
        >
          <option value="">{t('allCategories')}</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {categoryLabel(c, language)}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1 text-sm font-medium">
        {t('area')}
        <select
          className={selectClass}
          value={locationId ?? ''}
          onChange={(e) => onChange({ location_id: e.target.value ? Number(e.target.value) : null })}
        >
          <option value="">{t('allAreas')}</option>
          {areas.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}

function ResultsSkeleton({ people }: { people: boolean }) {
  return people ? (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 6 }, (_, i) => (
        <Skeleton key={i} className="h-24" />
      ))}
    </div>
  ) : (
    <CardGrid>
      {Array.from({ length: 8 }, (_, i) => (
        <Skeleton key={i} className="aspect-[3/4]" />
      ))}
    </CardGrid>
  );
}
