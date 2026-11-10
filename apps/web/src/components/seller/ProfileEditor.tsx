'use client';

import { useState } from 'react';
import { Controller } from 'react-hook-form';
import { z } from 'zod';
import { useQueryClient } from '@tanstack/react-query';
import {
  ApiRequestError,
  applyServerErrors,
  sellerKeys,
  unwrap,
  useApi,
  useConfig,
  useMyProfile,
  useTaxonomy,
  useZodForm,
  type OwnerProfile,
  type ProfileKind,
} from '@whyme/data';
import { Button, ButtonLink } from '@/components/ui/button';
import { CheckboxField, FieldGroup, TextAreaField, TextField } from '@/components/ui/field';
import { Skeleton } from '@/components/ui/skeleton';
import { MarketplaceIcon as Icon } from '@/components/ui/MarketplaceIcon';
import { Photo } from '@/components/market/Photo';
import { routes } from '@/lib/format';
import { translateFieldError, useT } from '@/lib/i18n';
import { useAccount } from '@/lib/session';
import { Card, conflictRecord, Notice, PageTitle, SectionTitle, sellerCapabilities, StatusBadge, StatusNote, useErrorText } from './common';
import { PhotoPicker, usePhotoList } from './PhotoPicker';
import { StartSelling } from './StartSelling';
import { AreaChecklist, CategorySelect, LocationSelect } from './TaxonomyFields';
import { useLeaveGuard } from './useLeaveGuard';
import styles from './SellerWorkspace.module.css';

const DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;
type Day = (typeof DAYS)[number];

const schema = z.object({
  display_name: z.string().trim().min(2, { message: 'seller:nameTooShort' }).max(120),
  category_id: z.number({ message: 'seller:chooseCategory' }).int().positive({ message: 'seller:chooseCategory' }),
  location_id: z.number({ message: 'seller:chooseLocation' }).int().positive({ message: 'seller:chooseLocation' }),
  about: z.string().trim().max(2000),
  availability_note: z.string().trim().max(200),
  hours: z
    .array(z.object({ day: z.enum(DAYS), open: z.boolean(), from: z.string(), to: z.string() }))
    .superRefine((hours, ctx) => {
      hours.forEach((h, i) => {
        if (h.open && (!h.from || !h.to || h.from >= h.to)) {
          ctx.addIssue({ code: 'custom', path: [i, 'to'], message: 'seller:hoursInvalid' });
        }
      });
    }),
  service_area_ids: z.array(z.number()),
  years_experience: z.string().trim().regex(/^\d{0,2}$/, { message: 'seller:yearsInvalid' }),
  rate_note: z.string().trim().max(200),
});

type FormInput = z.input<typeof schema>;
type FormOutput = z.output<typeof schema>;

const NEW_HOURS = DAYS.map((day) => ({ day, open: day !== 'sun', from: '08:00', to: '18:00' }));

function toForm(profile: OwnerProfile | null): FormInput {
  const hours = profile?.opening_hours as Partial<Record<Day, { open: string; close: string }[]>> | null | undefined;
  return {
    display_name: profile?.display_name ?? '',
    category_id: profile?.category_id ?? (undefined as unknown as number),
    location_id: profile?.location_id ?? (undefined as unknown as number),
    about: profile?.about ?? '',
    availability_note: profile?.availability_note ?? '',
    // One opening period per day in this form; the API allows up to three.
    hours: hours
      ? DAYS.map((day) => {
          const first = hours[day]?.[0];
          return { day, open: Boolean(first), from: first?.open ?? '08:00', to: first?.close ?? '18:00' };
        })
      : NEW_HOURS,
    service_area_ids: (profile?.service_area_ids ?? []).map(Number),
    years_experience: profile?.years_experience != null ? String(profile.years_experience) : '',
    rate_note: profile?.rate_note ?? '',
  };
}

/**
 * The business or provider page editor (PRO01–PRO03). Saving keeps a private
 * draft; publishing sends it to moderators when review applies. Images upload
 * as they're picked and only go public after a moderator has seen them (SAF04).
 */
export function ProfileEditor({ kind }: { kind: ProfileKind }) {
  const { t } = useT('seller');
  const { user } = useAccount();
  const caps = sellerCapabilities(user);
  const allowed = kind === 'business' ? caps.vendor : caps.provider;
  const profile = useMyProfile(kind, allowed);
  const taxonomy = useTaxonomy();

  if (!allowed) return <StartSelling only={kind === 'business' ? 'vendor' : 'provider'} />;

  if (profile.isPending || taxonomy.isPending) {
    return (
      <div className="flex max-w-3xl flex-col gap-4">
        <Skeleton className="h-10 w-72" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (profile.isError || taxonomy.isError) return <div className={styles.queryError}><Notice tone="error">{t('errors:network_error')}</Notice><Button variant="secondary" onClick={() => { void profile.refetch(); void taxonomy.refetch(); }}>{t('overview.tryAgain')}</Button></div>;

  // Keyed by kind only: creating the profile mustn't remount the form and lose its message.
  return <ProfileForm key={kind} kind={kind} profile={profile.data ?? null} />;
}

function ProfileForm({ kind, profile }: { kind: ProfileKind; profile: OwnerProfile | null }) {
  const { t } = useT('seller');
  const { t: tMarket } = useT('market');
  const api = useApi();
  const queryClient = useQueryClient();
  const errorText = useErrorText();
  const config = useConfig();
  const photoLimit = Number(config.data?.settings['profiles.max_photos.basic'] ?? 8);

  const [current, setCurrent] = useState(profile);
  const [notice, setNotice] = useState<{ tone: 'success' | 'info' | 'error'; text: string } | null>(null);
  const [imageErrors, setImageErrors] = useState<{ logo_id?: string; photo_ids?: string }>({});
  const logo = usePhotoList(profile?.logo ? [profile.logo] : [], 1, true);
  const photos = usePhotoList(profile?.photos ?? [], photoLimit);
  const form = useZodForm(schema, { defaultValues: toForm(profile) });
  const { errors, isSubmitting, isDirty } = form.formState;
  const fieldError = (message: string | undefined) => translateFieldError(t, message);

  useLeaveGuard(isDirty || logo.dirty || photos.dirty);

  function loaded(saved: OwnerProfile) {
    setCurrent(saved);
    queryClient.setQueryData(sellerKeys.profile(kind), saved);
    void queryClient.invalidateQueries({ queryKey: sellerKeys.profiles });
    form.reset(toForm(saved));
    logo.reset(saved.logo ? [saved.logo] : []);
    photos.reset(saved.photos);
  }

  async function save(values: FormOutput): Promise<OwnerProfile> {
    const body = {
      version: current?.version ?? null,
      display_name: values.display_name,
      category_id: values.category_id,
      location_id: values.location_id,
      about: values.about || null,
      availability_note: values.availability_note || null,
      opening_hours:
        kind === 'business' ? Object.fromEntries(values.hours.map((h) => [h.day, h.open ? [{ open: h.from, close: h.to }] : []])) : null,
      service_area_ids: kind === 'provider' ? values.service_area_ids : [],
      years_experience: kind === 'provider' && values.years_experience !== '' ? Number(values.years_experience) : null,
      rate_note: kind === 'provider' ? values.rate_note || null : null,
      logo_id: logo.ids[0] ?? null,
      photo_ids: photos.ids,
    };
    // The save response isn't typed by the spec (it can be 200 or 201), so it's read as the owner resource.
    const result = await api.PUT('/v1/me/profiles/{kind}', { params: { path: { kind } }, body: body as never });
    return (unwrap(result) as unknown as { data: OwnerProfile }).data;
  }

  const run = (publish: boolean) =>
    form.handleSubmit(async (values) => {
      setNotice(null);
      setImageErrors({});
      if (logo.busy || photos.busy) return setNotice({ tone: 'info', text: t('waitForPhotos') });

      try {
        // Always saved first: the API returns an unchanged profile as it is, and this
        // never trusts a dirty flag from a render that may predate the last keystroke.
        let saved = await save(values);
        if (publish && (saved.status === 'draft' || saved.status === 'rejected')) {
          saved = unwrap(
            await api.POST('/v1/me/profiles/{kind}/submit', { params: { path: { kind } }, body: { version: saved.version } }),
          ).data;
          loaded(saved);
          setNotice({ tone: 'success', text: saved.status === 'published' ? t('submittedLive') : t('submittedReview') });
          return;
        }
        loaded(saved);
        setNotice({ tone: 'success', text: saved.status === 'pending_review' && current?.status === 'published' ? t('submittedReview') : t('saved') });
      } catch (e) {
        const latest = conflictRecord<OwnerProfile>(e);
        if (latest) {
          loaded(latest);
          const inReviewNow = e instanceof ApiRequestError && e.code === 'in_review';
          return setNotice({ tone: 'info', text: inReviewNow ? t('inReviewLocked') : t('conflictReloaded') });
        }
        applyServerErrors(form, e);
        const fields = e instanceof ApiRequestError ? e.body?.fields : undefined;
        setImageErrors({ logo_id: fields?.logo_id?.[0], photo_ids: fields?.photo_ids?.[0] });
        setNotice({ tone: 'error', text: errorText(e, { limit: photoLimit }) });
      }
    });

  const canPublish = !current || current.status === 'draft' || current.status === 'rejected';
  // A moderator is checking it: nothing can change or be sent again until they're done (API: in_review).
  const inReview = current?.status === 'pending_review';
  const hours = form.watch('hours');

  return (
    <form method="post" onSubmit={(e) => void run(false)(e)} noValidate className={`${styles.editor} ${styles.controls}`}>
      <PageTitle
        title={kind === 'business' ? t('businessPage') : t('providerPage')}
        intro={t('profileIntro')}
        actions={
          current?.status === 'published' ? (
            <ButtonLink href={routes.profile(current)} variant="ghost">
              {t('viewPage')}
            </ButtonLink>
          ) : null
        }
      />

      {current ? (
        <div className={styles.statusBlock}>
          <StatusBadge status={current.status} />
          <StatusNote status={current.status} reason={current.status_reason} />
          {current.status === 'published' ? <p className="text-sm text-text-muted">{t('editLiveWarning')}</p> : null}
        </div>
      ) : null}

      <div className={styles.editorLayout}>
      <fieldset disabled={inReview} className={styles.editorFields}>
      <Card className={styles.basicsCard}>
        <SectionTitle number="01" title={t('workspace.profileBasics')} hint={t('workspace.profileBasicsHint')} />
        <TextField
          label={kind === 'business' ? t('displayNameBusiness') : t('displayNameProvider')}
          autoComplete="organization"
          error={fieldError(errors.display_name?.message)}
          {...form.register('display_name')}
        />
        <CategorySelect
          type={kind === 'business' ? 'product' : 'service'}
          label={kind === 'business' ? t('categoryBusiness') : t('categoryProvider')}
          error={fieldError(errors.category_id?.message)}
          {...form.register('category_id', { valueAsNumber: true })}
        />
        <LocationSelect className={styles.fullField} label={t('location')} error={fieldError(errors.location_id?.message)} {...form.register('location_id', { valueAsNumber: true })} />
        <TextAreaField className={styles.fullField} label={t('about')} hint={t('aboutHint')} error={fieldError(errors.about?.message)} {...form.register('about')} />
        <TextField
          className={styles.fullField}
          label={t('availabilityNote')}
          hint={t('availabilityHint')}
          error={fieldError(errors.availability_note?.message)}
          {...form.register('availability_note')}
        />
      </Card>

      {kind === 'business' ? (
        <Card className={styles.hoursCard}>
          <SectionTitle number="02" title={t('workspace.weeklySchedule')} hint={t('workspace.hoursIntro')} />
          <FieldGroup legend={t('openingHours')} hint={t('openingHoursHint')}>
            <div className="flex flex-col divide-y divide-border">
              {hours.map((h, i) => (
                <div key={h.day} className={styles.hourRow}>
                  <CheckboxField label={tMarket(h.day)} {...form.register(`hours.${i}.open`)} />
                  {h.open ? (
                    <div className={styles.hourTimes}>
                      <label className="sr-only" htmlFor={`opens-${h.day}`}>
                        {t('workspace.opensOn', { day: tMarket(h.day) })}
                      </label>
                      <input
                        id={`opens-${h.day}`}
                        type="time"
                        className="min-h-11 rounded-lg border border-border px-2"
                        {...form.register(`hours.${i}.from`)}
                      />
                      <span aria-hidden>–</span>
                      <label className="sr-only" htmlFor={`closes-${h.day}`}>
                        {t('workspace.closesOn', { day: tMarket(h.day) })}
                      </label>
                      <input
                        id={`closes-${h.day}`}
                        type="time"
                        aria-invalid={errors.hours?.[i]?.to ? true : undefined}
                        className="min-h-11 rounded-lg border border-border px-2 aria-invalid:border-danger"
                        {...form.register(`hours.${i}.to`)}
                      />
                    </div>
                  ) : (
                    <span className={styles.closedLabel}>{tMarket('closed')}</span>
                  )}
                  {errors.hours?.[i]?.to ? (
                    <p role="alert" className="w-full text-sm text-danger">
                      {fieldError(errors.hours[i]?.to?.message)}
                    </p>
                  ) : null}
                </div>
              ))}
            </div>
          </FieldGroup>
        </Card>
      ) : (
        <Card className={styles.providerDetails}>
          <div className={styles.fullField}><SectionTitle number="02" title={t('workspace.serviceDetails')} hint={t('workspace.serviceDetailsHint')} /></div>
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
            label={t('yearsExperience')}
            inputMode="numeric"
            maxLength={2}
            className="max-w-48"
            error={fieldError(errors.years_experience?.message)}
            {...form.register('years_experience')}
          />
          <TextField label={t('rateNote')} hint={t('rateNoteHint')} error={fieldError(errors.rate_note?.message)} {...form.register('rate_note')} />
        </Card>
      )}

      <Card className="flex flex-col gap-6">
        <SectionTitle number="03" title={t('workspace.photosTitle')} hint={t('workspace.photosIntro')} />
        <PhotoPicker photos={logo} label={t('logo')} hint={t('logoHint')} error={imageErrors.logo_id} readOnly={inReview} />
        <PhotoPicker
          photos={photos}
          label={t('profilePhotos')}
          hint={t('photosHint', { count: photoLimit })}
          error={imageErrors.photo_ids}
          readOnly={inReview}
        />
      </Card>
      </fieldset>
      <aside className={styles.editorAside} aria-label={t('workspace.profilePreview')}>
        <section className={styles.previewCard}><span className={styles.eyebrow}>{t('workspace.profilePreview')}</span><div className={styles.previewAvatar}>{logo.items[0]?.preview ? <Photo src={logo.items[0].preview} alt="" className={styles.previewPhoto} /> : <Icon name={kind === 'business' ? 'shop' : 'tools'} />}</div><h2>{form.watch('display_name') || t(kind === 'business' ? 'displayNameBusiness' : 'displayNameProvider')}</h2><span className={styles.previewKind}>{t(kind === 'business' ? 'businessPage' : 'providerPage')}</span><p>{form.watch('about') || t('workspace.previewHint')}</p><span className={styles.previewHint}><Icon name="image" />{t('workspace.previewNote')}</span></section>
        <section className={styles.editorGuide}><h2>{t('workspace.beforePublish')}</h2><p>{t('workspace.beforePublishHint')}</p><p>{t('publishHint')}</p></section>
      </aside>
      </div>

      {notice ? <Notice tone={notice.tone}>{notice.text}</Notice> : null}

      <div className={styles.actionBar}>
        {inReview ? (
          notice ? null : <Notice tone="info">{t('inReviewLocked')}</Notice>
        ) : canPublish ? (
          <>
            <Button type="button" onClick={(e) => void run(true)(e)} disabled={isSubmitting}>
              {isSubmitting ? t('common:loading') : t('publish')}
            </Button>
            <Button type="submit" variant="secondary" disabled={isSubmitting}>
              {t('saveDraft')}
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
