'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ApiRequestError,
  billingKeys,
  checkPurchase,
  keepListingsLive,
  startPurchase,
  unwrap,
  useApi,
  useBillingOverview,
  type BillingCatalogItem,
  type BillingOverview,
  type BillingPurchase,
  type BillingSku,
  type CheckedPurchase,
  type FeaturedPlacement,
  type ListingKind,
  type OwnerListing,
  type PlanSummary,
} from '@whyme/data';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { SelectField } from '@/components/ui/field';
import { Skeleton } from '@/components/ui/skeleton';
import { formatNaira, routes } from '@/lib/format';
import { useLanguage, useT } from '@/lib/i18n';
import { useAccount } from '@/lib/session';
import { Card, Notice, PageTitle, SectionTitle, sellerCapabilities, useErrorText } from './common';
import styles from './SellerWorkspace.module.css';

/** Payment states that may still turn into "paid" (the gateway hasn't given a final answer). */
const OPEN_PAYMENT = ['awaiting_payment', 'pending_verification', 'unknown'];
const CHECK_EVERY_MS = 5_000;
const MAX_CHECKS = 12;

function useDate() {
  const language = useLanguage();
  const format = new Intl.DateTimeFormat(language === 'ig' ? 'ig-NG' : 'en-NG', { dateStyle: 'medium' });
  return (iso: string | null | undefined) => (iso ? format.format(new Date(iso)) : '');
}

/**
 * The website Business Center (PAY03, MON01–MON06): Pro plans, choosing which listings stay
 * live after Pro ends, featured listings, job posts, and purchases. Everything is bought
 * through Paystack on the website; coming back, the page asks the API to check the payment
 * and never takes the browser's word for it.
 */
export function BusinessCenter() {
  const { t } = useT('seller');
  const { user } = useAccount();
  const caps = sellerCapabilities(user);
  const overview = useBillingOverview();
  const params = useSearchParams();
  const [returnedPurchase] = useState(() => params.get('purchase'));
  const [featureListing] = useState(() => params.get('feature'));

  return (
    <div className={`${styles.workspace} ${styles.controls}`}>
      <PageTitle title={t('billing.title')} intro={t('billing.intro')} />

      {returnedPurchase ? <PurchaseReturn purchaseId={returnedPurchase} /> : null}

      {overview.isPending ? (
        <div className="flex flex-col gap-4">
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
      ) : overview.isError ? (
        <div className={styles.queryError}>
          <Notice tone="error">{t('billing.loadFailed')}</Notice>
          <Button variant="secondary" disabled={overview.isFetching} onClick={() => void overview.refetch()}>
            {t('overview.tryAgain')}
          </Button>
        </div>
      ) : (
        <>
          <Plans overview={overview.data} vendor={caps.vendor} provider={caps.provider} />
          {caps.vendor || caps.provider ? <Featured overview={overview.data} preselect={featureListing} /> : null}
          <JobPosts overview={overview.data} employer={caps.employer} />
          <History purchases={overview.data.purchases} />
        </>
      )}
    </div>
  );
}

/** The catalog item for a SKU, and its name in the reader's language. */
function useCatalog(overview: BillingOverview) {
  const { t } = useT('seller');
  return {
    item: (sku: BillingSku) => overview.catalog.find((i) => i.sku === sku),
    name: (sku: BillingSku) => t(`billing.sku.${sku}`),
  };
}

/**
 * One purchase button. One tap, one purchase: locked while it runs and until the browser
 * leaves for Paystack; the client ID doubles as the Idempotency-Key, and a fresh one is made
 * only after a failed attempt.
 */
function BuyButton({
  item,
  label,
  listingId,
  vacancyId,
  disabled,
  variant = 'primary',
  onError,
}: {
  item: BillingCatalogItem;
  label: string;
  listingId?: string | null;
  vacancyId?: string | null;
  disabled?: boolean;
  variant?: 'primary' | 'secondary';
  onError: (message: string) => void;
}) {
  const { t } = useT('seller');
  const api = useApi();
  const queryClient = useQueryClient();
  const errorText = useErrorText();
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const clientId = useRef<string | null>(null);

  async function buy() {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    clientId.current ??= crypto.randomUUID();
    try {
      const started = await startPurchase(api, { sku: item.sku, listingId, vacancyId, expectedPriceKobo: item.price_kobo, clientId: clientId.current });
      if (started.checkout_url) {
        // Stays locked: the page is leaving for Paystack.
        window.location.assign(started.checkout_url);
        return;
      }
      await queryClient.invalidateQueries({ queryKey: billingKeys.all });
    } catch (e) {
      clientId.current = null;
      if (e instanceof ApiRequestError && e.code === 'price_mismatch') {
        const current = (e.body as { data?: { current_price_kobo?: number } } | null)?.data?.current_price_kobo;
        await queryClient.invalidateQueries({ queryKey: billingKeys.all });
        onError(current !== undefined ? t('billing.pay.priceChanged', { price: formatNaira(current) }) : errorText(e));
      } else {
        onError(errorText(e));
      }
    }
    lock.current = false;
    setBusy(false);
  }

  return (
    <Button variant={variant} disabled={disabled || busy} onClick={() => void buy()} className="self-start">
      {busy ? t('billing.pay.redirecting') : label}
    </Button>
  );
}

function Plans({ overview, vendor, provider }: { overview: BillingOverview; vendor: boolean; provider: boolean }) {
  const { t } = useT('seller');
  if (!vendor && !provider) {
    return (
      <Card className="flex flex-col gap-2">
        <SectionTitle number="01" title={t('billing.plans.title')} />
        <p className="text-sm text-text-muted">{t('billing.plans.none')}</p>
      </Card>
    );
  }
  return (
    <Card className="flex flex-col gap-4">
      <SectionTitle number="01" title={t('billing.plans.title')} hint={t('billing.plans.hint')} />
      <div className="grid gap-4 md:grid-cols-2">
        {vendor ? <PlanCard overview={overview} kind="product" plan={overview.summary.vendor_plan} sku="vendor_pro_30d" /> : null}
        {provider ? <PlanCard overview={overview} kind="service" plan={overview.summary.provider_plan} sku="provider_pro_30d" /> : null}
      </div>
    </Card>
  );
}

function PlanCard({ overview, kind, plan, sku }: { overview: BillingOverview; kind: ListingKind; plan: PlanSummary; sku: BillingSku }) {
  const { t } = useT('seller');
  const date = useDate();
  const catalog = useCatalog(overview);
  const item = catalog.item(sku);
  const [error, setError] = useState<string | null>(null);
  const [choosing, setChoosing] = useState(false);
  const pro = plan.tier === 'pro';

  return (
    <section className="flex flex-col gap-3 rounded-2xl border border-border p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-bold">{t(kind === 'product' ? 'billing.plans.vendor' : 'billing.plans.provider')}</h3>
        <Badge tone={pro ? 'primary' : 'neutral'}>{pro ? t('billing.plans.pro') : t('billing.plans.basic')}</Badge>
      </div>
      {pro && plan.ends_at ? <p className="text-sm font-semibold">{t('billing.plans.proUntil', { date: date(plan.ends_at) })}</p> : null}
      <p className="text-sm">{t('billing.plans.usage', { used: plan.used, cap: plan.cap })}</p>
      <p className="text-sm text-text-muted">{t('billing.plans.compare', { basic: plan.basic_cap, pro: plan.pro_cap })}</p>
      <p className="text-sm text-text-muted">{t('billing.plans.photos', { count: plan.max_listing_photos })}</p>

      {plan.over_limit_count > 0 ? (
        <div className="flex flex-col gap-2 rounded-xl bg-accent-soft p-3">
          <p className="text-sm font-semibold">{t('billing.plans.overLimit', { count: plan.over_limit_count })}</p>
          {choosing ? null : (
            <Button variant="secondary" className="self-start" onClick={() => setChoosing(true)}>
              {t('billing.plans.choose')}
            </Button>
          )}
        </div>
      ) : null}
      {choosing ? <KeepLive kind={kind} cap={plan.cap} onClose={() => setChoosing(false)} /> : null}

      {item ? (
        <>
          <BuyButton
            item={item}
            label={t(pro ? 'billing.plans.extend' : 'billing.plans.buy', { price: formatNaira(item.price_kobo) })}
            variant={pro ? 'secondary' : 'primary'}
            onError={setError}
          />
          {pro ? <p className="text-xs text-text-muted">{t('billing.plans.extendHint')}</p> : null}
        </>
      ) : null}
      {error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}
    </section>
  );
}

/** The seller's listings of one kind, all statuses (a few pages at most: plan caps are small). */
function useListingsOf(kind: ListingKind | null) {
  const api = useApi();
  return useQuery({
    queryKey: ['me', 'seller', 'listings', 'billing', kind ?? 'all'],
    queryFn: async () => {
      const all: OwnerListing[] = [];
      let cursor: string | undefined;
      for (let page = 0; page < 5; page++) {
        // The cursor isn't in the generated query types.
        const query = { kind: kind ?? undefined, cursor } as Record<string, unknown>;
        const body = unwrap(await api.GET('/v1/me/listings', { params: { query: query as never } }));
        all.push(...body.data);
        const next = body.links.next ? new URL(body.links.next).searchParams.get('cursor') : null;
        if (!next) break;
        cursor = next;
      }
      return all;
    },
  });
}

/**
 * After Pro ends: the seller picks which listings stay live, up to the plan's cap (MON04, AT44).
 * The others are paused, never deleted; picking a paused one resumes it.
 */
function KeepLive({ kind, cap, onClose }: { kind: ListingKind; cap: number; onClose: () => void }) {
  const { t } = useT('seller');
  const api = useApi();
  const queryClient = useQueryClient();
  const errorText = useErrorText();
  const listings = useListingsOf(kind);
  const choosable = (listings.data ?? []).filter((l) => ['published', 'pending_review', 'paused'].includes(l.status));
  const [chosen, setChosen] = useState<string[] | null>(null);
  const selected = chosen ?? choosable.filter((l) => l.status !== 'paused').map((l) => l.id).slice(0, cap);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);

  function toggle(id: string) {
    setMessage(null);
    setChosen(selected.includes(id) ? selected.filter((x) => x !== id) : selected.length < cap ? [...selected, id] : selected);
  }

  async function save() {
    if (busy) return;
    setBusy(true);
    setMessage(null);
    try {
      const result = await keepListingsLive(api, kind, selected);
      setMessage({ tone: 'success', text: t('billing.keep.saved', { kept: result.kept_live_ids.length, paused: result.paused_ids.length }) });
      await queryClient.invalidateQueries({ queryKey: billingKeys.all });
      await queryClient.invalidateQueries({ queryKey: ['me', 'seller', 'listings'] });
      setChosen(null);
    } catch (e) {
      setMessage({ tone: 'error', text: errorText(e, { limit: cap }) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <fieldset className="flex flex-col gap-3 rounded-xl border border-border p-3">
      <legend className="px-1 font-semibold">{t('billing.keep.title')}</legend>
      <p className="text-sm text-text-muted">{t(`billing.keep.hint_${kind}`, { cap })}</p>
      {listings.isPending ? (
        <Skeleton className="h-24 w-full" />
      ) : choosable.length === 0 ? (
        <p className="text-sm">{t('billing.keep.none')}</p>
      ) : (
        <ul className="flex flex-col gap-1">
          {choosable.map((listing) => {
            const checked = selected.includes(listing.id);
            return (
              <li key={listing.id}>
                <label className="flex min-h-11 items-center gap-3 rounded-lg px-2 hover:bg-surface">
                  <input
                    type="checkbox"
                    className="size-5 accent-primary"
                    checked={checked}
                    disabled={!checked && selected.length >= cap}
                    onChange={() => toggle(listing.id)}
                  />
                  <span className="min-w-0 flex-1 truncate">{listing.title}</span>
                  <span className="text-xs text-text-muted">
                    {t(listing.status === 'paused' ? 'billing.keep.paused' : listing.status === 'pending_review' ? 'billing.keep.review' : 'billing.keep.live')}
                  </span>
                </label>
              </li>
            );
          })}
        </ul>
      )}
      <p className="text-sm" aria-live="polite">
        {t('billing.keep.selected', { count: selected.length, cap })}
        {selected.length >= cap && choosable.length > cap ? ` ${t('billing.keep.full')}` : ''}
      </p>
      {message ? <Notice tone={message.tone}>{message.text}</Notice> : null}
      <div className="flex flex-wrap gap-2">
        <Button disabled={busy || listings.isPending || choosable.length === 0} onClick={() => void save()}>
          {busy ? t('common:loading') : t('billing.keep.save')}
        </Button>
        <Button variant="ghost" disabled={busy} onClick={onClose}>
          {t('billing.keep.close')}
        </Button>
      </div>
    </fieldset>
  );
}

function Featured({ overview, preselect }: { overview: BillingOverview; preselect: string | null }) {
  const { t } = useT('seller');
  const catalog = useCatalog(overview);
  const listings = useListingsOf(null);
  const live = (listings.data ?? []).filter((l) => l.status === 'published' || l.status === 'pending_review');
  const [listingId, setListingId] = useState<string>('');
  const [sku, setSku] = useState<BillingSku>('featured_listing_7d');
  const [error, setError] = useState<string | null>(null);
  const chosenListing = listingId || (preselect && live.some((l) => l.id === preselect) ? preselect : '');
  const item = catalog.item(sku);
  const options = (['featured_listing_7d', 'featured_listing_30d'] as const).map((s) => catalog.item(s)).filter((i): i is BillingCatalogItem => Boolean(i));

  return (
    <Card id="featured" className="flex flex-col gap-4">
      <SectionTitle number="02" title={t('billing.featured.title')} hint={t('billing.featured.hint')} />
      {listings.isPending ? (
        <Skeleton className="h-24 w-full" />
      ) : live.length === 0 ? (
        <p className="text-sm text-text-muted">{t('billing.featured.noListings')}</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          <SelectField
            label={t('billing.featured.listing')}
            value={chosenListing}
            onChange={(e) => {
              setError(null);
              setListingId(e.target.value);
            }}
          >
            <option value="">{t('billing.featured.chooseListing')}</option>
            {live.map((l) => (
              <option key={l.id} value={l.id}>
                {l.title}
              </option>
            ))}
          </SelectField>
          <SelectField label={t('billing.featured.duration')} value={sku} onChange={(e) => setSku(e.target.value as BillingSku)}>
            {options.map((o) => (
              <option key={o.sku} value={o.sku}>
                {t('billing.featured.days', { count: o.term_days, price: formatNaira(o.price_kobo) })}
              </option>
            ))}
          </SelectField>
        </div>
      )}
      {item && live.length > 0 ? (
        <BuyButton
          key={`${sku}:${chosenListing}`}
          item={item}
          listingId={chosenListing || null}
          disabled={!chosenListing}
          label={t('billing.featured.buy', { price: formatNaira(item.price_kobo) })}
          onError={setError}
        />
      ) : null}
      {error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}
      {overview.featured_placements.length > 0 ? <Placements placements={overview.featured_placements} /> : null}
    </Card>
  );
}

function Placements({ placements }: { placements: FeaturedPlacement[] }) {
  const { t } = useT('seller');
  const date = useDate();
  return (
    <div className="flex flex-col gap-2">
      <h3 className="font-semibold">{t('billing.featured.history')}</h3>
      <ul className="flex flex-col divide-y divide-border rounded-xl border border-border">
        {placements.map((p) => (
          <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 p-3">
            {p.listing_slug ? (
              <Link href={routes.listing({ id: p.listing_id, slug: p.listing_slug })} className="min-w-0 truncate font-semibold hover:underline">
                {p.listing_title}
              </Link>
            ) : (
              <span className="min-w-0 truncate font-semibold">{p.listing_title}</span>
            )}
            <span className="text-sm text-text-muted">
              {p.status === 'active'
                ? t('billing.featured.active', { date: date(p.ends_at) })
                : p.status === 'pending_approval'
                  ? t('billing.featured.pending')
                  : p.status === 'expired'
                    ? t('billing.featured.expired', { date: date(p.ends_at) })
                    : t('billing.featured.cancelled')}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function JobPosts({ overview, employer }: { overview: BillingOverview; employer: boolean }) {
  const { t } = useT('seller');
  const catalog = useCatalog(overview);
  const jobs = overview.summary.jobs;
  const standard = catalog.item('job_standard_30d');
  const featured = catalog.item('job_featured_30d');
  const [error, setError] = useState<string | null>(null);

  return (
    <Card className="flex flex-col gap-4">
      <SectionTitle number="03" title={t('billing.jobs.title')} hint={t('billing.jobs.hint', { days: jobs.free_term_days })} />
      <ul className="flex flex-wrap gap-2 text-sm">
        <li>
          <Badge tone={jobs.free_job_available ? 'primary' : 'neutral'}>{t(jobs.free_job_available ? 'billing.jobs.free' : 'billing.jobs.freeUsed')}</Badge>
        </li>
        <li>
          <Badge>{t('billing.jobs.standard', { count: jobs.standard_credits_available })}</Badge>
        </li>
        <li>
          <Badge>{t('billing.jobs.featured', { count: jobs.featured_credits_available })}</Badge>
        </li>
      </ul>
      {employer ? (
        <>
          <div className="flex flex-wrap gap-2">
            {standard ? <BuyButton item={standard} label={t('billing.jobs.buyStandard', { price: formatNaira(standard.price_kobo) })} onError={setError} /> : null}
            {featured ? (
              <BuyButton item={featured} variant="secondary" label={t('billing.jobs.buyFeatured', { price: formatNaira(featured.price_kobo) })} onError={setError} />
            ) : null}
          </div>
          <p className="text-sm text-text-muted">{t('billing.jobs.useHint')}</p>
        </>
      ) : (
        <p className="text-sm">
          {t('billing.jobs.needEmployer')}{' '}
          <Link href={routes.sellJobs} className="font-semibold text-primary hover:underline">
            {t('billing.jobs.setUp')}
          </Link>
        </p>
      )}
      {error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}
    </Card>
  );
}

function History({ purchases }: { purchases: BillingPurchase[] }) {
  const { t } = useT('seller');
  const date = useDate();
  return (
    <Card className="flex flex-col gap-3">
      <SectionTitle number="04" title={t('billing.history.title')} />
      {purchases.length === 0 ? (
        <p className="text-sm text-text-muted">{t('billing.history.empty')}</p>
      ) : (
        <ul className="flex flex-col divide-y divide-border rounded-xl border border-border">
          {purchases.map((p) => (
            <PurchaseRow key={p.id} purchase={p} when={date(p.paid_at ?? p.created_at)} />
          ))}
        </ul>
      )}
    </Card>
  );
}

function PurchaseRow({ purchase, when }: { purchase: BillingPurchase; when: string }) {
  const { t } = useT('seller');
  const api = useApi();
  const queryClient = useQueryClient();
  const errorText = useErrorText();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const target = purchase.snapshot.listing_title ?? purchase.snapshot.vacancy_title ?? null;
  const waiting = purchase.status === 'awaiting_payment';

  async function check() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await checkPurchase(api, purchase.id);
      await queryClient.invalidateQueries({ queryKey: billingKeys.all });
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <li className="flex flex-wrap items-center justify-between gap-3 p-3">
      <div className="flex min-w-0 flex-col gap-0.5">
        <p className="font-semibold">{t(`billing.sku.${purchase.sku}`)}</p>
        {target ? <p className="truncate text-sm text-text-muted">{t('billing.history.for', { title: target })}</p> : null}
        <p className="text-xs text-text-muted">
          {purchase.number} · {when}
        </p>
        {error ? (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        ) : null}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-semibold">{formatNaira(purchase.amount_kobo)}</span>
        <Badge tone={purchase.status === 'paid' ? 'primary' : waiting ? 'warning' : 'neutral'}>
          {t(purchase.status === 'paid' ? 'billing.history.paid' : waiting ? 'billing.history.awaiting' : 'billing.history.cancelled')}
        </Badge>
        {waiting ? (
          <Button variant="secondary" className="min-h-11 px-3 text-sm" disabled={busy} onClick={() => void check()}>
            {busy ? t('common:loading') : t('billing.history.check')}
          </Button>
        ) : null}
      </div>
    </li>
  );
}

/**
 * Back from Paystack (`?purchase=`): ask the API to check the payment with the gateway, then
 * again every few seconds while a bank is still confirming it (about a minute at most).
 */
function PurchaseReturn({ purchaseId }: { purchaseId: string }) {
  const { t } = useT('seller');
  const api = useApi();
  const queryClient = useQueryClient();
  const [result, setResult] = useState<CheckedPurchase | null>(null);
  const [failed, setFailed] = useState(false);
  const checks = useRef(0);

  useEffect(() => {
    let cancelled = false;
    let timer: number | undefined;
    const run = async () => {
      checks.current += 1;
      try {
        const checked = await checkPurchase(api, purchaseId);
        if (cancelled) return;
        setResult(checked);
        queryClient.setQueryData<BillingOverview>(billingKeys.overview, (old) => (old ? { ...old, summary: checked.summary } : old));
        void queryClient.invalidateQueries({ queryKey: billingKeys.all });
        const open = checked.purchase.status === 'awaiting_payment' && OPEN_PAYMENT.includes(checked.purchase.payment_state ?? 'awaiting_payment');
        if (open && checks.current < MAX_CHECKS) timer = window.setTimeout(() => void run(), CHECK_EVERY_MS);
      } catch {
        if (!cancelled) setFailed(true);
      }
    };
    void run();
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [api, purchaseId, queryClient]);

  if (failed && !result) return <Notice tone="error">{t('billing.return.unknown')}</Notice>;
  if (!result) return <Notice tone="info">{t('billing.return.checking')}</Notice>;
  const { purchase } = result;
  if (purchase.status === 'paid') return <Notice tone="success">{t('billing.return.paid', { item: t(`billing.sku.${purchase.sku}`) })}</Notice>;
  if (purchase.status === 'awaiting_payment' && OPEN_PAYMENT.includes(purchase.payment_state ?? 'awaiting_payment')) {
    return <Notice tone="info">{t(purchase.payment_state === 'pending_verification' ? 'billing.return.pending' : 'billing.return.checking')}</Notice>;
  }
  return <Notice tone="error">{t('billing.return.failed')}</Notice>;
}
