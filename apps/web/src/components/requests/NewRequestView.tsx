'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useRef, useState, type FormEvent } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ApiRequestError,
  isConnectionError,
  isRetryable,
  requestKeys,
  unwrap,
  useApi,
  useOfflineFetcher,
  useTaxonomy,
  type PreferredTime,
  type PublicListing,
  type PublicProfile,
} from '@whyme/data';
import { errorKey } from '@whyme/i18n';
import { PhotoPicker, restoreTiles, usePhotoList, type PhotoItem } from '@/components/seller/PhotoPicker';
import { CategorySelect, LocationSelect } from '@/components/seller/TaxonomyFields';
import { Button, ButtonLink } from '@/components/ui/button';
import { SelectField, TextAreaField, TextField } from '@/components/ui/field';
import { Skeleton } from '@/components/ui/skeleton';
import { formatNaira, koboToNaira, nairaToKobo, routes } from '@/lib/format';
import { useT } from '@/lib/i18n';
import { useAccountRuntime } from '@/lib/offline';
import {
  discardRequestDraft,
  saveRequestDraft,
  useRequestDraft,
  type RequestDraft,
} from '@/lib/request-queue';

const MAX_PHOTOS = 5;
const TIMES: PreferredTime[] = ['any', 'morning', 'afternoon', 'evening'];

/**
 * Create a service request (REQ01, REQ03, OFF05, AT06) for a service listing (`?listing=`)
 * or a provider profile (`?profile=`), or reopen a queued offline request (`?draft=`).
 * Records `client_id` and `client_created_at` on the device so a retry never duplicates
 * the request, and queues the request + photos in IndexedDB when offline.
 */
export function NewRequestView() {
  const params = useSearchParams();
  const draftId = params.get('draft');
  const draft = useRequestDraft(draftId);

  if (draftId && draft === undefined) {
    return (
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-4">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-72 w-full" />
      </div>
    );
  }

  return <RequestEditor key={draftId ?? 'new'} draft={draft ?? null} />;
}

function RequestEditor({ draft }: { draft: RequestDraft | null }) {
  const { t } = useT('requests');
  const { t: tSync } = useT('sync');
  const api = useApi();
  const sync = useAccountRuntime();
  const router = useRouter();
  const params = useSearchParams();
  const queryClient = useQueryClient();
  const taxonomy = useTaxonomy();

  const listingId = params.get('listing') ?? draft?.payload.listing_id ?? undefined;
  const profileId = params.get('profile') ?? draft?.payload.profile_id ?? undefined;

  const fetchListing = useOfflineFetcher('listing', listingId ?? '', async () =>
    unwrap(await api.GET('/v1/listings/{listing}', { params: { path: { listing: listingId ?? '' } } })).data as PublicListing,
  );
  const listing = useQuery({
    queryKey: ['listing', listingId],
    queryFn: fetchListing,
    enabled: Boolean(listingId),
  });

  const fetchProfile = useOfflineFetcher('profile', profileId ?? '', async () =>
    unwrap(await api.GET('/v1/profiles/{profile}', { params: { path: { profile: profileId ?? '' } } })).data as PublicProfile,
  );
  const profile = useQuery({
    queryKey: ['profile', profileId],
    queryFn: fetchProfile,
    enabled: Boolean(!listingId && profileId),
  });

  const restoredPhotos: PhotoItem[] | undefined = draft
    ? restoreTiles(draft.payload.photos, draft.uploads, [])
    : undefined;

  const [title, setTitle] = useState<string | null>(() => draft?.payload.title ?? null);
  const [categoryId, setCategoryId] = useState<string | null>(() =>
    draft ? String(draft.payload.category_id) : null,
  );
  const [locationId, setLocationId] = useState<string | null>(() =>
    draft ? String(draft.payload.location_id) : null,
  );
  const [description, setDescription] = useState(() => draft?.payload.description ?? '');
  const [preferredDate, setPreferredDate] = useState(() => draft?.payload.preferred_date ?? '');
  const [preferredTime, setPreferredTime] = useState<PreferredTime | ''>(() => draft?.payload.preferred_time ?? '');
  const [budgetMin, setBudgetMin] = useState(() => koboToNaira(draft?.payload.budget_min_kobo));
  const [budgetMax, setBudgetMax] = useState(() => koboToNaira(draft?.payload.budget_max_kobo));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(() =>
    draft?.problem?.lastErrorCode ? t(errorKey(draft.problem.lastErrorCode)) : null,
  );
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const photos = usePhotoList([], MAX_PHOTOS, false, restoredPhotos, 'request_photo');
  const intent = useRef<{ body: string; key: string; createdAt: string } | null>(
    draft
      ? {
          body: '',
          key: draft.localId,
          createdAt: draft.payload.client_created_at,
        }
      : null,
  );
  const inFlight = useRef(false);

  function clearError(field: string) {
    setFieldErrors((current) => {
      if (!(field in current)) return current;
      const rest = { ...current };
      delete rest[field];
      return rest;
    });
  }

  if (!listingId && !profileId) {
    return (
      <div className="mx-auto flex max-w-2xl flex-col gap-3 rounded-2xl bg-surface p-6">
        <p>{t('targetMissing')}</p>
        <ButtonLink href={routes.search({ type: 'service' })} variant="secondary" className="self-start">
          {t('browseServices')}
        </ButtonLink>
      </div>
    );
  }

  if (!draft && ((listingId && listing.isPending) || (!listingId && profileId && profile.isPending))) {
    return (
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-4">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-72 w-full" />
      </div>
    );
  }

  if (!draft && ((listingId && listing.isError) || (!listingId && profileId && profile.isError))) {
    return <p className="mx-auto max-w-2xl rounded-lg bg-surface p-4 text-danger">{t('errors:provider_unavailable')}</p>;
  }

  const targetListing = listing.data ?? null;
  const targetProfile = profile.data ?? null;
  const chosenTitle = title ?? targetListing?.title ?? '';
  const chosenCategoryId =
    categoryId ??
    (targetListing
      ? String(targetListing.category.id)
      : targetProfile
        ? String(targetProfile.category.id)
        : '');
  const chosenLocationId =
    locationId ??
    (targetListing
      ? String(targetListing.location.id)
      : targetProfile
        ? String(targetProfile.location.id)
        : '');
  const backHref = targetListing
    ? routes.listing(targetListing)
    : targetProfile
      ? routes.profile(targetProfile)
      : routes.requests();
  const today = new Date().toISOString().slice(0, 10);

  async function queueOffline(
    key: string,
    createdAt: string,
    minKobo: number | null,
    maxKobo: number | null,
  ): Promise<boolean> {
    if (!sync) return false;
    const locName =
      taxonomy.data?.locations.find((l) => l.id === Number(chosenLocationId))?.name ??
      targetListing?.location.name ??
      targetProfile?.location.name ??
      draft?.payload.location_name ??
      '';
    const targetName =
      targetListing?.seller.name ??
      targetProfile?.display_name ??
      draft?.payload.target_name ??
      '';

    const { uploads } = await saveRequestDraft(sync, {
      localId: key,
      createdAt,
      listing_id: targetListing?.id ?? listingId,
      profile_id: targetProfile?.id ?? profileId,
      target_name: targetName,
      location_name: locName,
      category_id: Number(chosenCategoryId),
      location_id: Number(chosenLocationId),
      title: chosenTitle.trim(),
      description: description.trim(),
      preferred_date: preferredDate || null,
      preferred_time: preferredTime || null,
      budget_min_kobo: minKobo,
      budget_max_kobo: maxKobo,
      photos: photos.items,
    });
    photos.markQueued(uploads);
    router.push(routes.requests());
    return true;
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (inFlight.current || photos.busy) return;

    const problems: Record<string, string> = {};
    if (chosenTitle.trim().length < 3) problems.title = t('titleRequired');
    if (!chosenCategoryId) problems.category_id = t('categoryRequired');
    if (!chosenLocationId) problems.location_id = t('locationRequired');
    if (description.trim().length < 10) problems.description = t('descriptionRequired');
    if (preferredDate && preferredDate < today) problems.preferred_date = t('preferredDateInvalid');

    const minKobo = nairaToKobo(budgetMin);
    const maxKobo = nairaToKobo(budgetMax);
    if (Number.isNaN(minKobo)) problems.budget_min_kobo = t('budgetInvalid');
    if (Number.isNaN(maxKobo)) problems.budget_max_kobo = t('budgetInvalid');
    if (minKobo !== null && maxKobo !== null && !Number.isNaN(minKobo) && !Number.isNaN(maxKobo) && maxKobo < minKobo) {
      problems.budget_max_kobo = t('budgetInvalid');
    }

    setFieldErrors(problems);
    if (Object.keys(problems).length > 0) return;

    const payload = {
      ...(listingId ? { listing_id: listingId } : {}),
      ...(profileId && !listingId ? { profile_id: profileId } : {}),
      category_id: Number(chosenCategoryId),
      location_id: Number(chosenLocationId),
      title: chosenTitle.trim(),
      description: description.trim(),
      preferred_date: preferredDate || null,
      preferred_time: preferredTime || null,
      budget_min_kobo: minKobo,
      budget_max_kobo: maxKobo,
      photo_ids: photos.ids,
    };

    const signature = JSON.stringify(payload);
    if (intent.current?.body !== signature) {
      intent.current = {
        body: signature,
        key: draft?.localId ?? crypto.randomUUID(),
        createdAt: draft?.payload.client_created_at ?? new Date().toISOString(),
      };
    }
    const { key, createdAt } = intent.current;

    inFlight.current = true;
    setBusy(true);
    setError(null);

    if (sync && (!navigator.onLine || photos.waiting || draft)) {
      if (await queueOffline(key, createdAt, minKobo, maxKobo)) return;
    }

    try {
      const created = unwrap(
        await api.POST('/v1/requests', {
          body: {
            ...payload,
            client_id: key,
            client_created_at: createdAt,
          },
          headers: { 'Idempotency-Key': key },
        }),
      ).data;
      void queryClient.invalidateQueries({ queryKey: requestKeys.all });
      router.push(routes.request(created.id));
    } catch (e) {
      if ((isConnectionError(e) || isRetryable(e)) && (await queueOffline(key, createdAt, minKobo, maxKobo))) {
        return;
      }
      const apiError = e instanceof ApiRequestError ? e : null;
      const fields = (apiError?.body as { fields?: Record<string, string[]> } | null)?.fields ?? {};
      setFieldErrors(Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, v[0] ?? ''])));
      setError(
        apiError?.code === 'content_blocked'
          ? t('errors:content_blocked')
          : t(errorKey(apiError?.code ?? 'network_error')),
      );
      inFlight.current = false;
      setBusy(false);
    }
  }

  async function onDiscardDraft() {
    if (!sync || !draft) return;
    await discardRequestDraft(sync, draft.localId);
    router.push(routes.requests());
  }

  return (
    <form method="post" onSubmit={(e) => void submit(e)} className="mx-auto flex w-full max-w-2xl flex-col gap-6" noValidate>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{t('newTitle')}</h1>
          <p className="mt-1 text-sm text-text-muted">{t('newIntro')}</p>
        </div>
        {draft ? (
          <Button type="button" variant="ghost" className="text-danger" onClick={() => void onDiscardDraft()}>
            {t('discardOfflineDraft')}
          </Button>
        ) : null}
      </div>

      {draft ? (
        <p role="status" className="rounded-xl bg-accent-soft p-3 text-xs font-semibold text-accent-text">
          {tSync('savedOffline')}
        </p>
      ) : null}

      {targetListing ? (
        <section className="flex items-center gap-4 rounded-2xl border border-border p-4">
          <div className="size-16 shrink-0 overflow-hidden rounded-lg bg-surface">
            {targetListing.photos[0]?.urls.thumb ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={targetListing.photos[0].urls.thumb} alt="" className="size-full object-cover" />
            ) : null}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">{t('forService')}</p>
            <p className="font-semibold leading-snug">{targetListing.title}</p>
            <p className="text-sm text-text-muted">{t('providedBy', { name: targetListing.seller.name })}</p>
            {targetListing.price_kobo ? <p className="mt-0.5 text-sm font-bold text-primary">{formatNaira(targetListing.price_kobo)}</p> : null}
          </div>
        </section>
      ) : targetProfile ? (
        <section className="flex items-center gap-4 rounded-2xl border border-border p-4">
          <div className="size-16 shrink-0 overflow-hidden rounded-full bg-surface">
            {targetProfile.logo?.thumb ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={targetProfile.logo.thumb} alt="" className="size-full object-cover" />
            ) : null}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">{t('forProvider')}</p>
            <p className="font-semibold leading-snug">{targetProfile.display_name}</p>
            <p className="text-sm text-text-muted">
              {targetProfile.category.name} · {targetProfile.location.name}
            </p>
          </div>
        </section>
      ) : null}

      <section className="flex flex-col gap-4 rounded-2xl border border-border p-4">
        <h2 className="font-bold">{t('whatYouNeed')}</h2>

        <TextField
          label={t('titleLabel')}
          value={chosenTitle}
          onChange={(e) => {
            setTitle(e.target.value);
            clearError('title');
          }}
          maxLength={120}
          hint={t('titleHint')}
          error={fieldErrors.title}
        />

        {!targetListing ? (
          <CategorySelect
            type="service"
            label={t('categoryLabel')}
            value={chosenCategoryId}
            onChange={(e) => {
              setCategoryId(e.target.value);
              clearError('category_id');
            }}
            error={fieldErrors.category_id}
          />
        ) : null}

        <LocationSelect
          label={t('locationLabel')}
          value={chosenLocationId}
          onChange={(e) => {
            setLocationId(e.target.value);
            clearError('location_id');
          }}
          hint={t('locationHint')}
          error={fieldErrors.location_id}
        />

        <TextAreaField
          label={t('descriptionLabel')}
          value={description}
          onChange={(e) => {
            setDescription(e.target.value);
            clearError('description');
          }}
          rows={5}
          maxLength={3000}
          hint={t('descriptionHint')}
          error={fieldErrors.description}
        />
      </section>

      <section className="flex flex-col gap-4 rounded-2xl border border-border p-4">
        <h2 className="font-bold">{t('whenAndBudget')}</h2>

        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            type="date"
            label={t('preferredDate')}
            min={today}
            value={preferredDate}
            onChange={(e) => {
              setPreferredDate(e.target.value);
              clearError('preferred_date');
            }}
            error={fieldErrors.preferred_date}
          />

          <SelectField
            label={t('preferredTime')}
            value={preferredTime}
            onChange={(e) => {
              setPreferredTime(e.target.value as PreferredTime | '');
              clearError('preferred_time');
            }}
            error={fieldErrors.preferred_time}
          >
            <option value="">{t('time.any')}</option>
            {TIMES.map((slot) => (
              <option key={slot} value={slot}>
                {t(`time.${slot}`)}
              </option>
            ))}
          </SelectField>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            label={t('budgetMin')}
            inputMode="numeric"
            value={budgetMin}
            onChange={(e) => {
              setBudgetMin(e.target.value);
              clearError('budget_min_kobo');
            }}
            error={fieldErrors.budget_min_kobo}
          />
          <TextField
            label={t('budgetMax')}
            inputMode="numeric"
            value={budgetMax}
            onChange={(e) => {
              setBudgetMax(e.target.value);
              clearError('budget_max_kobo');
            }}
            error={fieldErrors.budget_max_kobo}
          />
        </div>
        <p className="text-xs text-text-muted">{t('budgetHint')}</p>
      </section>

      <section className="rounded-2xl border border-border p-4">
        <PhotoPicker
          photos={photos}
          label={t('photosTitle')}
          hint={t('photosHint', { max: MAX_PHOTOS })}
          error={fieldErrors.photo_ids}
        />
      </section>

      <p className="rounded-lg bg-accent-soft p-3 text-xs text-accent-text">{t('safetyNote')}</p>

      <div className="flex flex-col gap-3">
        {error ? (
          <p role="alert" className="rounded-lg bg-surface p-3 text-sm text-danger">
            {error}
          </p>
        ) : null}
        <Button type="submit" disabled={busy || photos.busy} className="min-h-12">
          {busy ? t('submitting') : t('submit')}
        </Button>
        <Link href={backHref} className="text-sm font-semibold text-primary hover:underline">
          {targetListing ? t('backToService') : t('backToProvider')}
        </Link>
      </div>
    </form>
  );
}
