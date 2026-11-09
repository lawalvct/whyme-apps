'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useRef, useState, type FormEvent } from 'react';
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiRequestError, orderKeys, unwrap, useApi, useTerms, type CheckoutQuote, type PublicListing } from '@whyme/data';
import { errorKey } from '@whyme/i18n';
import { ReturnsPolicy } from '@/components/market/ReturnsPolicy';
import { PaymentMethods } from '@/components/payments/PaymentMethods';
import { LocationSelect } from '@/components/seller/TaxonomyFields';
import { Button, ButtonLink } from '@/components/ui/button';
import { CheckboxField, SelectField, TextAreaField, TextField } from '@/components/ui/field';
import { Skeleton } from '@/components/ui/skeleton';
import { formatNaira, routes } from '@/lib/format';
import { useLanguage, useT } from '@/lib/i18n';

type Method = 'pickup' | 'delivery';

/**
 * Buy with protection (JRN01, FIN07): the buyer picks quantity and pickup or delivery,
 * sees the total the server worked out, reads how Protected Payment works, agrees, and
 * goes to Paystack's page. The order is created first, so coming back later finds it.
 */
export function CheckoutView({ listingId }: { listingId: string }) {
  const { t } = useT('orders');
  const api = useApi();
  const router = useRouter();
  const queryClient = useQueryClient();
  const language = useLanguage();

  const [quantity, setQuantity] = useState(1);
  const [method, setMethod] = useState<Method | null>(null);
  const [areaId, setAreaId] = useState('');
  const [address, setAddress] = useState('');
  const [note, setNote] = useState('');
  const [accepted, setAccepted] = useState(false);
  const [showTerms, setShowTerms] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  // One key per distinct order the buyer agreed to: a retry after a lost response returns the same order.
  const intent = useRef<{ body: string; key: string } | null>(null);
  const inFlight = useRef(false);

  const listing = useQuery({
    queryKey: ['listing', listingId],
    queryFn: async () => unwrap(await api.GET('/v1/listings/{listing}', { params: { path: { listing: listingId } } })).data as PublicListing,
  });

  const options = (listing.data?.fulfilment ?? []).filter((f): f is Method => f === 'pickup' || f === 'delivery');
  const chosen: Method = method ?? options[0] ?? 'pickup';

  const quote = useQuery({
    queryKey: orderKeys.quote(listingId, quantity, chosen),
    queryFn: async () =>
      unwrap(
        await api.POST('/v1/checkout/quote', { body: { listing_id: listingId, quantity, fulfilment_method: chosen } }),
      ).data as unknown as CheckoutQuote,
    enabled: listing.isSuccess,
    placeholderData: keepPreviousData,
    retry: (count, e) => !(e instanceof ApiRequestError && e.status < 500) && count < 2,
  });

  const terms = useTerms('buyer', language, showTerms);

  function clearError(field: string) {
    setFieldErrors((current) => {
      if (!(field in current)) return current;
      const rest = { ...current };
      delete rest[field];
      return rest;
    });
  }

  if (listing.isPending) {
    return (
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-4">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }
  if (listing.isError) {
    return <p className="mx-auto max-w-2xl rounded-lg bg-surface p-4 text-danger">{t('errors:listing_unavailable')}</p>;
  }

  const item = listing.data;
  const quoteCode = quote.error instanceof ApiRequestError ? quote.error.code : quote.isError ? 'network_error' : null;
  const total = quote.data ? formatNaira(quote.data.total_kobo) : '';
  const maxQuantity = Math.min(99, quote.data?.available_quantity ?? 99);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (inFlight.current || !quote.data) return;

    const problems: Record<string, string> = {};
    if (chosen === 'delivery') {
      if (!areaId) problems['delivery.location_id'] = t('areaRequired');
      if (address.trim().length < 5) problems['delivery.address'] = t('addressRequired');
    }
    if (!accepted) problems.accept_terms = t('acceptRequired');
    setFieldErrors(problems);
    if (Object.keys(problems).length > 0) return;

    const body = {
      listing_id: listingId,
      quantity,
      fulfilment_method: chosen,
      ...(chosen === 'delivery' ? { delivery: { location_id: Number(areaId), address: address.trim(), note: note.trim() || null } } : {}),
      accept_terms: true as const,
    };
    const signature = JSON.stringify(body);
    if (intent.current?.body !== signature) intent.current = { body: signature, key: crypto.randomUUID() };
    const key = intent.current.key;

    inFlight.current = true;
    setBusy(true);
    setError(null);
    try {
      const order = unwrap(
        await api.POST('/v1/orders', { body: { ...body, client_id: key }, headers: { 'Idempotency-Key': key } }),
      ).data;
      void queryClient.invalidateQueries({ queryKey: orderKeys.all });

      const pay = unwrap(
        await api.POST('/v1/orders/{order}/pay', { params: { path: { order: order.id } }, body: {}, headers: { 'Idempotency-Key': `${key}-pay` } }),
      ).data;
      if (pay.checkout_url) {
        // Paystack's own page; it sends the buyer back to the order afterwards. Stay disabled until it loads.
        window.location.assign(pay.checkout_url);
        return;
      }
      router.push(routes.order(order.id));
    } catch (e) {
      const apiError = e instanceof ApiRequestError ? e : null;
      const fields = (apiError?.body as { fields?: Record<string, string[]> } | null)?.fields ?? {};
      setFieldErrors(Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, v[0] ?? ''])));
      setError(t(errorKey(apiError?.code ?? 'network_error')));
      inFlight.current = false;
      setBusy(false);
    }
  }

  return (
    <form method="post" onSubmit={(e) => void submit(e)} className="mx-auto flex w-full max-w-2xl flex-col gap-6" noValidate>
      <div>
        <h1 className="text-2xl font-bold">{t('checkoutTitle')}</h1>
        <p className="mt-1 text-sm text-text-muted">{t('checkoutIntro')}</p>
      </div>

      <section className="flex items-center gap-4 rounded-2xl border border-border p-4">
        <div className="size-20 shrink-0 overflow-hidden rounded-lg bg-surface">
          {item.photos[0]?.urls.thumb ? (
            // Public WebP thumb from the API.
            // eslint-disable-next-line @next/next/no-img-element
            <img src={item.photos[0].urls.thumb} alt="" className="size-full object-cover" />
          ) : null}
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-semibold leading-snug">{item.title}</p>
          <p className="text-sm text-text-muted">{t('soldBy', { name: item.seller.name })}</p>
          <p className="mt-1 font-bold text-primary">{item.price_kobo ? formatNaira(item.price_kobo) : ''}</p>
        </div>
      </section>

      {quoteCode === 'checkout_unavailable' ? (
        <div className="flex flex-col gap-3 rounded-2xl bg-surface p-4">
          <p>{t('unavailable')}</p>
          <ButtonLink href={routes.listing(item)} variant="secondary" className="self-start">
            {t('backToItem')}
          </ButtonLink>
        </div>
      ) : (
        <>
          <section className="flex flex-col gap-4">
            <SelectField
              label={t('quantity')}
              value={quantity}
              onChange={(e) => setQuantity(Number(e.target.value))}
              hint={quote.data?.available_quantity != null ? t('available', { count: quote.data.available_quantity }) : undefined}
              error={quoteCode === 'not_enough_stock' ? t('errors:not_enough_stock') : undefined}
              className="max-w-40"
            >
              {Array.from({ length: Math.max(1, Math.min(maxQuantity, 20)) }, (_, i) => i + 1).map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </SelectField>

            <fieldset className="flex flex-col gap-2">
              <legend className="mb-2 text-sm font-medium">{t('howYouGetIt')}</legend>
              {(options.length > 0 ? options : (['pickup'] as Method[])).map((option) => (
                <label
                  key={option}
                  className="flex cursor-pointer gap-3 rounded-xl border border-border p-3 has-checked:border-primary has-checked:bg-primary-soft/40"
                >
                  <input
                    type="radio"
                    name="fulfilment_method"
                    value={option}
                    checked={chosen === option}
                    onChange={() => setMethod(option)}
                    className="mt-1 size-5 shrink-0 accent-primary"
                  />
                  <span>
                    <span className="block font-semibold">{t(option === 'pickup' ? 'pickupLabel' : 'deliveryLabel')}</span>
                    <span className="block text-sm text-text-muted">{t(option === 'pickup' ? 'pickupHint' : 'deliveryHint')}</span>
                  </span>
                </label>
              ))}
            </fieldset>

            {chosen === 'delivery' ? (
              <div className="flex flex-col gap-4 rounded-2xl border border-border p-4">
                <LocationSelect
                  label={t('deliveryArea')}
                  value={areaId}
                  onChange={(e) => {
                    setAreaId(e.target.value);
                    clearError('delivery.location_id');
                  }}
                  error={fieldErrors['delivery.location_id']}
                />
                <TextField
                  label={t('deliveryAddress')}
                  value={address}
                  onChange={(e) => {
                    setAddress(e.target.value);
                    clearError('delivery.address');
                  }}
                  maxLength={300}
                  autoComplete="street-address"
                  hint={t('deliveryAddressHint')}
                  error={fieldErrors['delivery.address']}
                />
                <TextAreaField
                  label={t('deliveryNote')}
                  value={note}
                  onChange={(e) => {
                    setNote(e.target.value);
                    clearError('delivery.note');
                  }}
                  maxLength={300}
                  rows={2}
                  hint={t('deliveryNoteHint')}
                  error={fieldErrors['delivery.note']}
                />
              </div>
            ) : null}
          </section>

          <section aria-live="polite" className="rounded-2xl border border-border p-4">
            <h2 className="mb-3 font-bold">{t('summary')}</h2>
            {quote.data ? (
              <dl className="flex flex-col gap-2 text-sm">
                <Row label={t('items', { count: quote.data.quantity, price: formatNaira(quote.data.unit_price_kobo) })} value={formatNaira(quote.data.subtotal_kobo)} />
                {quote.data.fulfilment_method === 'delivery' ? (
                  <Row label={t('delivery')} value={quote.data.delivery_fee_kobo ? formatNaira(quote.data.delivery_fee_kobo) : t('noCharge')} />
                ) : null}
                {quote.data.buyer_fee_kobo ? <Row label={t('serviceFee')} value={formatNaira(quote.data.buyer_fee_kobo)} /> : null}
                <div className="mt-1 flex items-baseline justify-between border-t border-border pt-3 text-base font-bold">
                  <dt>{t('total')}</dt>
                  <dd className={quote.isFetching ? 'opacity-60' : undefined}>{total}</dd>
                </div>
              </dl>
            ) : quote.isError && quoteCode !== 'not_enough_stock' ? (
              <p role="alert" className="text-sm text-danger">
                {quoteCode === 'network_error' ? t('quoteFailed') : t(errorKey(quoteCode ?? 'network_error'))}
              </p>
            ) : (
              <Skeleton className="h-16 w-full" />
            )}
          </section>

          <section className="rounded-2xl bg-primary-soft/40 p-4">
            <h2 className="mb-2 font-bold">{t('protectionTitle')}</h2>
            <ul className="flex list-disc flex-col gap-1.5 pl-5 text-sm">
              <li>{t('protectionPay')}</li>
              <li>{t('protectionHold')}</li>
              <li>{t('protectionRelease')}</li>
              <li className="font-semibold">{t('protectionOutside')}</li>
            </ul>
            <ReturnsPolicy terms={item.refund_policy} className="mt-3" />
            <button
              type="button"
              className="mt-3 text-sm font-semibold text-primary underline-offset-2 hover:underline"
              aria-expanded={showTerms}
              onClick={() => setShowTerms((v) => !v)}
            >
              {t('readTerms', { title: quote.data?.terms.title ?? '' })}
            </button>
            {showTerms ? (
              <div className="mt-2 max-h-64 overflow-y-auto rounded-lg bg-background p-3 text-sm whitespace-pre-line">
                {terms.data?.body ?? <Skeleton className="h-16 w-full" />}
              </div>
            ) : null}
          </section>

          <div className="flex flex-col gap-3">
            <CheckboxField
              label={t('acceptTerms', { total })}
              checked={accepted}
              onChange={(e) => {
                setAccepted(e.target.checked);
                clearError('accept_terms');
              }}
              disabled={!quote.data}
            />
            {fieldErrors.accept_terms ? (
              <p role="alert" className="text-sm text-danger">
                {fieldErrors.accept_terms}
              </p>
            ) : null}
            {error ? (
              <p role="alert" className="rounded-lg bg-surface p-3 text-sm text-danger">
                {error}
              </p>
            ) : null}
            <PaymentMethods />
            <Button type="submit" disabled={busy || !quote.data || quote.isFetching} className="min-h-12">
              {busy ? t('opening') : t('pay', { total })}
            </Button>
            <p className="text-xs text-text-muted">{t('payWith')}</p>
            <Link href={routes.listing(item)} className="text-sm font-semibold text-primary hover:underline">
              {t('backToItem')}
            </Link>
          </div>
        </>
      )}
    </form>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="text-text-muted">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  );
}
