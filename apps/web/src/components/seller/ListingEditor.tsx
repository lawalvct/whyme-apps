'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { Controller, type FieldValues, type Path, type UseFormReturn } from 'react-hook-form';
import { z } from 'zod';
import { useQueryClient } from '@tanstack/react-query';
import {
  ApiRequestError,
  sellerKeys,
  unwrap,
  useApi,
  useConfig,
  useMyListing,
  useMyProfile,
  useTaxonomy,
  useZodForm,
  type ListingKind,
  type OwnerListing,
} from '@whyme/data';
import { Button } from '@/components/ui/button';
import { CheckboxField, FieldGroup, TextAreaField, TextField } from '@/components/ui/field';
import { Skeleton } from '@/components/ui/skeleton';
import { koboToNaira, nairaToKobo, routes } from '@/lib/format';
import { translateFieldError, useT } from '@/lib/i18n';
import { useAccount } from '@/lib/session';
import { Card, conflictRecord, Notice, PageTitle, sellerCapabilities, StatusBadge, StatusNote, useErrorText } from './common';
import { PhotoPicker, usePhotoList } from './PhotoPicker';
import { StartSelling } from './StartSelling';
import { AreaChecklist, CategorySelect, LocationSelect } from './TaxonomyFields';
import { useLeaveGuard } from './useLeaveGuard';

const schema = z.object({
  title: z.string().trim().min(3, { message: 'seller:titleTooShort' }).max(120),
  category_id: z.number({ message: 'seller:chooseCategory' }).int().positive({ message: 'seller:chooseCategory' }),
  location_id: z.number({ message: 'seller:chooseLocation' }).int().positive({ message: 'seller:chooseLocation' }),
  description: z.string().trim().min(10, { message: 'seller:descriptionTooShort' }).max(5000),
  price: z.string().refine((v) => !Number.isNaN(nairaToKobo(v)), { message: 'seller:priceInvalid' }),
  quantity: z.string().trim().regex(/^\d{0,7}$/, { message: 'seller:quantityInvalid' }),
  fulfilment: z.array(z.enum(['pickup', 'delivery'])),
  service_area_ids: z.array(z.number()),
  availability_note: z.string().trim().max(200),
  // Returns and refunds: not stated, none, or within a number of days (WHY ME staff check it).
  returns: z.enum(['unset', 'none', 'accepted']),
  return_days: z.string().trim().regex(/^(|[1-9]|[12]\d|30)$/, { message: 'seller:returnDaysInvalid' }),
  return_conditions: z.string().trim().max(500),
});

type FormInput = z.input<typeof schema>;
type FormOutput = z.output<typeof schema>;

function returnsOf(listing: OwnerListing | null): FormInput['returns'] {
  const policy = listing?.refund_policy;
  if (!policy) return 'unset';
  return policy.accepts_returns ? 'accepted' : 'none';
}

function toForm(listing: OwnerListing | null, defaults: { location_id?: number; service_area_ids?: number[] } = {}): FormInput {
  return {
    returns: returnsOf(listing),
    return_days: listing?.refund_policy?.return_days != null ? String(listing.refund_policy.return_days) : '',
    return_conditions: listing?.refund_policy?.conditions ?? '',
    title: listing?.title ?? '',
    category_id: listing?.category_id ?? (undefined as unknown as number),
    location_id: listing?.location_id ?? defaults.location_id ?? (undefined as unknown as number),
    description: listing?.description ?? '',
    price: koboToNaira(listing?.price_kobo),
    quantity: listing?.quantity != null ? String(listing.quantity) : '',
    fulfilment: (listing?.fulfilment ?? ['pickup']) as ('pickup' | 'delivery')[],
    service_area_ids: (listing?.service_area_ids ?? defaults.service_area_ids ?? []).map(Number),
    availability_note: listing?.availability_note ?? '',
  };
}

/** Server field names that differ from the form's (price is typed in naira, sent in kobo). */
const serverNames: Record<string, string> = {
  price_kobo: 'price',
  'refund_policy.return_days': 'return_days',
  'refund_policy.conditions': 'return_conditions',
};

function applyFieldErrors<T extends FieldValues>(form: UseFormReturn<T>, error: unknown, known: readonly string[]): string | undefined {
  const fields = error instanceof ApiRequestError ? error.body?.fields : undefined;
  for (const [key, messages] of Object.entries(fields ?? {})) {
    const name = serverNames[key] ?? key.split('.')[0];
    if (known.includes(name)) form.setError(name as Path<T>, { type: 'server', message: messages[0] });
  }
  return fields?.photo_ids?.[0];
}

/** Add or edit a listing (route: /sell/listings/new?kind=… or /sell/listings/{id}). */
export function ListingEditor({ id }: { id?: string }) {
  const { t } = useT('seller');
  const { user } = useAccount();
  const caps = sellerCapabilities(user);
  // Read once: after the first save the address becomes /sell/listings/{id} without `?kind`.
  const params = useSearchParams();
  const [requested] = useState(() => params.get('kind'));
  const existing = useMyListing(id ?? null);
  const kind: ListingKind = existing.data?.kind ?? (requested === 'service' || (!caps.vendor && requested !== 'product') ? 'service' : 'product');
  const allowed = kind === 'product' ? caps.vendor : caps.provider;
  // New listings start with the location (and areas served) from the seller's page.
  const profile = useMyProfile(kind === 'product' ? 'business' : 'provider', allowed && !id);
  const taxonomy = useTaxonomy();

  if (!allowed && !(id && existing.isPending)) return <StartSelling only={kind === 'product' ? 'vendor' : 'provider'} />;

  if ((id ? existing.isPending : profile.isPending) || taxonomy.isPending) {
    return (
      <div className="flex max-w-3xl flex-col gap-4">
        <Skeleton className="h-10 w-72" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (id && existing.isError) {
    const missing = existing.error instanceof ApiRequestError && existing.error.status === 404;
    return <Notice tone="error">{t(missing ? 'errors:not_found' : 'errors:network_error')}</Notice>;
  }

  const defaults = profile.data ? { location_id: profile.data.location_id, service_area_ids: profile.data.service_area_ids.map(Number) } : {};
  return <ListingForm key={kind} kind={kind} listing={existing.data ?? null} defaults={defaults} />;
}

function ListingForm({
  kind,
  listing,
  defaults,
}: {
  kind: ListingKind;
  listing: OwnerListing | null;
  defaults: { location_id?: number; service_area_ids?: number[] };
}) {
  const { t } = useT('seller');
  const { t: tMarket } = useT('market');
  const api = useApi();
  const queryClient = useQueryClient();
  const errorText = useErrorText();
  const config = useConfig();
  const photoLimit = Number(config.data?.settings['listings.max_photos.basic'] ?? 5);

  // Makes a double-tapped or retried create return the same draft (OFF05).
  const [clientId] = useState(() => crypto.randomUUID());
  const [current, setCurrent] = useState(listing);
  const [notice, setNotice] = useState<{ tone: 'success' | 'info' | 'error'; text: string } | null>(null);
  const [photoError, setPhotoError] = useState<string | undefined>();
  const photos = usePhotoList(listing?.photos ?? [], photoLimit);
  const form = useZodForm(schema, { defaultValues: toForm(listing, defaults) });
  const { errors, isSubmitting, isDirty } = form.formState;
  const fieldError = (message: string | undefined) => translateFieldError(t, message);
  const product = kind === 'product';

  useLeaveGuard(isDirty || photos.dirty);

  function loaded(saved: OwnerListing) {
    setCurrent(saved);
    queryClient.setQueryData(sellerKeys.listing(saved.id), saved);
    void queryClient.invalidateQueries({ queryKey: ['me', 'seller', 'listings'] });
    form.reset(toForm(saved));
    photos.reset(saved.photos);
  }

  async function save(values: FormOutput): Promise<OwnerListing> {
    const content = {
      category_id: values.category_id,
      location_id: values.location_id,
      title: values.title,
      description: values.description,
      price_kobo: nairaToKobo(values.price),
      quantity: product && values.quantity !== '' ? Number(values.quantity) : null,
      fulfilment: product ? values.fulfilment : [],
      service_area_ids: product ? [] : values.service_area_ids,
      availability_note: product ? null : values.availability_note || null,
      refund_policy:
        values.returns === 'unset'
          ? null
          : {
              accepts_returns: values.returns === 'accepted',
              return_days: values.returns === 'accepted' ? Number(values.return_days) : null,
              conditions: values.return_conditions || null,
            },
      photo_ids: photos.ids,
    };

    if (current) {
      const path = { params: { path: { listing: current.id } } };
      return unwrap(await api.PATCH('/v1/me/listings/{listing}', { ...path, body: { ...content, version: current.version } })).data;
    }
    // The create response can be 200 (replayed) or 201, which the spec doesn't type.
    const result = await api.POST('/v1/me/listings', { body: { ...content, kind, client_id: clientId } });
    const created = (unwrap(result) as unknown as { data: OwnerListing }).data;
    // Stay on this screen, but give it the listing's own address for reloads and sharing.
    window.history.replaceState(null, '', routes.editListing(created.id));
    return created;
  }

  const run = (publish: boolean) =>
    form.handleSubmit(async (values) => {
      setNotice(null);
      setPhotoError(undefined);
      if (photos.busy) return setNotice({ tone: 'info', text: t('waitForPhotos') });
      if (values.returns === 'accepted' && values.return_days === '') {
        return form.setError('return_days', { type: 'required', message: 'seller:returnDaysInvalid' });
      }

      try {
        // Always saved first: the API returns an unchanged listing as it is, and this
        // never trusts a dirty flag from a render that may predate the last keystroke.
        let saved = await save(values);
        if (publish && ['draft', 'rejected', 'expired', 'paused'].includes(saved.status)) {
          // Saved even if publishing is then refused (e.g. contact details in the text).
          loaded(saved);
          saved = unwrap(
            await api.POST('/v1/me/listings/{listing}/submit', {
              params: { path: { listing: saved.id } },
              body: { version: saved.version },
            }),
          ).data;
          loaded(saved);
          return setNotice({ tone: 'success', text: saved.status === 'published' ? t('submittedLive') : t('submittedReview') });
        }
        const wasLive = current?.status === 'published';
        loaded(saved);
        setNotice({ tone: 'success', text: wasLive && saved.status === 'pending_review' ? t('submittedReview') : t('saved') });
      } catch (e) {
        const latest = conflictRecord<OwnerListing>(e);
        if (latest) {
          loaded(latest);
          const inReviewNow = e instanceof ApiRequestError && e.code === 'in_review';
          return setNotice({ tone: 'info', text: inReviewNow ? t('inReviewLocked') : t('conflictReloaded') });
        }
        setPhotoError(applyFieldErrors(form, e, Object.keys(schema.shape)));
        setNotice({ tone: 'error', text: errorText(e, { limit: photoLimit }) });
      }
    });

  const returns = form.watch('returns');
  const status = current?.status;
  const canPublish = !current || status === 'draft' || status === 'rejected' || status === 'expired' || status === 'paused';
  // A moderator is checking it: nothing can change or be sent again until they're done (API: in_review).
  const inReview = status === 'pending_review';

  return (
    <form method="post" onSubmit={(e) => void run(false)(e)} noValidate className="flex max-w-3xl flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Link href={routes.sellListings()} className="text-sm font-semibold text-primary hover:underline">
          ← {t('navListings')}
        </Link>
        <PageTitle title={inReview ? current?.title ?? '' : current ? t('editListing') : product ? t('newProduct') : t('newService')} />
      </div>

      {current ? (
        <div className="flex flex-col gap-1">
          <StatusBadge status={current.status} />
          <StatusNote status={current.status} reason={current.status_reason} />
          {status === 'published' ? <p className="text-sm text-text-muted">{t('editLiveWarning')}</p> : null}
        </div>
      ) : null}

      <fieldset disabled={inReview} className="flex min-w-0 flex-col gap-6">
      <Card className="flex flex-col gap-4">
        <TextField
          label={t('listingTitle')}
          hint={product ? t('listingTitleHintProduct') : t('listingTitleHintService')}
          maxLength={120}
          error={fieldError(errors.title?.message)}
          {...form.register('title')}
        />
        <CategorySelect
          type={kind}
          label={tMarket('category')}
          error={fieldError(errors.category_id?.message)}
          {...form.register('category_id', { valueAsNumber: true })}
        />
        <TextAreaField
          label={t('description')}
          hint={product ? t('descriptionHintProduct') : t('descriptionHintService')}
          rows={6}
          error={fieldError(errors.description?.message)}
          {...form.register('description')}
        />
      </Card>

      <Card className="flex flex-col gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            label={product ? t('price') : t('priceService')}
            hint={product ? undefined : t('priceServiceHint')}
            inputMode="decimal"
            error={fieldError(errors.price?.message)}
            {...form.register('price')}
          />
          {product ? (
            <TextField
              label={t('quantity')}
              hint={t('quantityHint')}
              inputMode="numeric"
              error={fieldError(errors.quantity?.message)}
              {...form.register('quantity')}
            />
          ) : null}
        </div>

        {product ? (
          <FieldGroup legend={t('fulfilment')} hint={t('fulfilmentHint')} error={fieldError(errors.fulfilment?.message)}>
            <div className="flex flex-wrap gap-x-6">
              <CheckboxField label={tMarket('pickup')} value="pickup" {...form.register('fulfilment')} />
              <CheckboxField label={tMarket('delivery')} value="delivery" {...form.register('fulfilment')} />
            </div>
          </FieldGroup>
        ) : null}

        <LocationSelect
          label={product ? t('listingLocationProduct') : t('listingLocationService')}
          error={fieldError(errors.location_id?.message)}
          {...form.register('location_id', { valueAsNumber: true })}
        />

        {product ? null : (
          <>
            <Controller
              control={form.control}
              name="service_area_ids"
              render={({ field, fieldState }) => (
                <AreaChecklist
                  legend={t('serviceAreas')}
                  hint={t('serviceAreasHint')}
                  value={field.value}
                  onChange={field.onChange}
                  error={fieldError(fieldState.error?.message)}
                />
              )}
            />
            <TextField
              label={t('availabilityNote')}
              hint={t('availabilityHint')}
              error={fieldError(errors.availability_note?.message)}
              {...form.register('availability_note')}
            />
          </>
        )}
      </Card>

      <Card>
        <PhotoPicker photos={photos} label={t('photos')} hint={t('photosHint', { count: photoLimit })} error={photoError} readOnly={inReview} />
      </Card>

      <Card className="flex flex-col gap-4">
        <FieldGroup legend={t('returns.title')} hint={t(product ? 'returns.hintProduct' : 'returns.hintService')}>
          <CheckboxField type="radio" value="unset" label={t('returns.unset')} {...form.register('returns')} />
          <CheckboxField type="radio" value="none" label={t('returns.none')} {...form.register('returns')} />
          <CheckboxField type="radio" value="accepted" label={t(product ? 'returns.acceptedProduct' : 'returns.acceptedService')} {...form.register('returns')} />
        </FieldGroup>
        {returns === 'accepted' ? (
          <TextField
            label={t('returns.days')}
            hint={t('returns.daysHint')}
            inputMode="numeric"
            className="sm:max-w-xs"
            error={fieldError(errors.return_days?.message)}
            {...form.register('return_days')}
          />
        ) : null}
        {returns !== 'unset' ? (
          <TextAreaField
            label={t('returns.conditions')}
            hint={t('returns.conditionsHint')}
            rows={2}
            maxLength={500}
            error={fieldError(errors.return_conditions?.message)}
            {...form.register('return_conditions')}
          />
        ) : null}
        <PolicyReview policy={current?.refund_policy ?? null} />
      </Card>
      </fieldset>

      {notice ? <Notice tone={notice.tone}>{notice.text}</Notice> : null}

      <div className="flex flex-wrap items-center gap-3">
        {inReview ? (
          notice ? null : <Notice tone="info">{t('inReviewLocked')}</Notice>
        ) : canPublish ? (
          <>
            <Button type="button" onClick={(e) => void run(true)(e)} disabled={isSubmitting}>
              {isSubmitting ? t('common:loading') : status === 'paused' ? t('resume') : t('publish')}
            </Button>
            <Button type="submit" variant="secondary" disabled={isSubmitting}>
              {current ? t('saveChanges') : t('saveDraft')}
            </Button>
          </>
        ) : (
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? t('common:loading') : t('saveChanges')}
          </Button>
        )}
        {canPublish ? <p className="text-sm text-text-muted">{t('publishHint')}</p> : null}
      </div>
    </form>
  );
}

/** Where WHY ME's check of the returns policy stands. Buyers see the policy only once approved. */
function PolicyReview({ policy }: { policy: OwnerListing['refund_policy'] }) {
  const { t } = useT('seller');
  if (!policy) return null;
  if (policy.state === 'rejected') {
    return (
      <p className="text-sm text-warning">
        {t('returns.rejected')} {policy.review_note?.trim() || t('noReason')}
      </p>
    );
  }
  return <p className="text-sm text-text-muted">{t(policy.state === 'approved' ? 'returns.approved' : 'returns.pending')}</p>;
}
