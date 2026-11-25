'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  categoryLabel,
  jobKeys,
  unwrap,
  useApi,
  useBillingOverview,
  useEmployerOverview,
  useMyVacancy,
  useTaxonomy,
  useVacancyApplications,
  type EmploymentType,
} from '@whyme/data';
import { Card, Notice, PageTitle, useErrorText } from '@/components/seller/common';
import { Button, buttonClass } from '@/components/ui/button';
import { SelectField, TextAreaField, TextField } from '@/components/ui/field';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDay, koboToNaira, nairaToKobo, routes } from '@/lib/format';
import { useLanguage, useT } from '@/lib/i18n';
import { ApplicationStatusBadge, EMPLOYMENT_TYPES, VacancyStatusBadge } from './JobFormat';

export function VacancyEditor({ vacancyId }: { vacancyId?: string }) {
  const { t } = useT('jobs');
  const language = useLanguage();
  const router = useRouter();
  const api = useApi();
  const queryClient = useQueryClient();
  const errorText = useErrorText();

  const existingQuery = useMyVacancy(vacancyId ?? null, Boolean(vacancyId));
  const employerOverview = useEmployerOverview(true);
  const taxonomy = useTaxonomy();

  const existing = existingQuery.data ?? null;
  const jobCategories = (taxonomy.data?.categories ?? []).filter((c) => c.type === 'job');
  const locations = (taxonomy.data?.locations ?? []).filter((l) => l.type !== 'state');

  const [titleInput, setTitleInput] = useState<string | null>(null);
  const [companyNameInput, setCompanyNameInput] = useState<string | null>(null);
  const [categoryIdInput, setCategoryIdInput] = useState<number | null>(null);
  const [locationIdInput, setLocationIdInput] = useState<number | null>(null);
  const [employmentTypeInput, setEmploymentTypeInput] = useState<EmploymentType | null>(null);
  const [salaryMinInput, setSalaryMinInput] = useState<string | null>(null);
  const [salaryMaxInput, setSalaryMaxInput] = useState<string | null>(null);
  const [deadlineInput, setDeadlineInput] = useState<string | null>(null);
  const [experienceInput, setExperienceInput] = useState<string | null>(null);
  const [descriptionInput, setDescriptionInput] = useState<string | null>(null);
  const [requirementsInput, setRequirementsInput] = useState<string | null>(null);

  const [busy, setBusy] = useState(false);
  // A featured job post bought in the Business Center can be used when publishing (MON03).
  const billing = useBillingOverview();
  const featuredCredits = billing.data?.summary.jobs.featured_credits_available ?? 0;
  const [preferFeatured, setPreferFeatured] = useState(false);
  const [message, setMessage] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);

  const [defaultDeadline] = useState(() => {
    const d = new Date(Date.now() + 14 * 24 * 60 * 60_000);
    return d.toISOString().slice(0, 10);
  });

  if (vacancyId && existingQuery.isPending) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-80 w-full" />
      </div>
    );
  }

  const title = titleInput ?? existing?.title ?? '';
  const companyName =
    companyNameInput ?? existing?.company_name ?? employerOverview.data?.profile?.company_name ?? '';
  const categoryId = categoryIdInput ?? existing?.category_id ?? jobCategories[0]?.id ?? 0;
  const locationId =
    locationIdInput ??
    existing?.location_id ??
    employerOverview.data?.profile?.location_id ??
    locations[0]?.id ??
    0;
  const employmentType: EmploymentType = employmentTypeInput ?? existing?.employment_type ?? 'full_time';
  const salaryMin = salaryMinInput ?? koboToNaira(existing?.salary_min_kobo);
  const salaryMax = salaryMaxInput ?? koboToNaira(existing?.salary_max_kobo);
  const deadline = deadlineInput ?? (existing?.deadline_at ? existing.deadline_at.slice(0, 10) : defaultDeadline);
  const experience = experienceInput ?? existing?.experience ?? '';
  const description = descriptionInput ?? existing?.description ?? '';
  const requirements = requirementsInput ?? existing?.requirements ?? '';

  async function save(submitAfterSave: boolean) {
    setMessage(null);
    const minKobo = nairaToKobo(salaryMin);
    const maxKobo = nairaToKobo(salaryMax);
    if (Number.isNaN(minKobo) || Number.isNaN(maxKobo)) {
      setMessage({ tone: 'error', text: t('seller:priceInvalid') });
      return;
    }

    setBusy(true);
    try {
      let saved = existing;
      const deadlineIso = new Date(`${deadline}T23:59:59Z`).toISOString();

      if (!saved) {
        saved = unwrap(
          await api.POST('/v1/me/vacancies', {
            body: {
              category_id: Number(categoryId),
              location_id: Number(locationId),
              title: title.trim(),
              company_name: companyName.trim() || null,
              employment_type: employmentType,
              description: description.trim(),
              requirements: requirements.trim() || null,
              experience: experience.trim() || null,
              salary_min_kobo: minKobo,
              salary_max_kobo: maxKobo,
              deadline_at: deadlineIso,
            },
          }),
        ).data;
      } else {
        saved = unwrap(
          await api.PATCH('/v1/me/vacancies/{vacancy}', {
            params: { path: { vacancy: saved.id } },
            body: {
              version: saved.version,
              category_id: Number(categoryId),
              location_id: Number(locationId),
              title: title.trim(),
              company_name: companyName.trim() || undefined,
              employment_type: employmentType,
              description: description.trim(),
              requirements: requirements.trim() || null,
              experience: experience.trim() || null,
              salary_min_kobo: minKobo,
              salary_max_kobo: maxKobo,
              deadline_at: deadlineIso,
            },
          }),
        ).data;
      }

      if (submitAfterSave && saved) {
        saved = unwrap(
          await api.POST('/v1/me/vacancies/{vacancy}/submit', {
            params: { path: { vacancy: saved.id } },
            body: { version: saved.version, ...(preferFeatured && featuredCredits > 0 ? { prefer_featured: true } : {}) },
          }),
        ).data;
      }

      await queryClient.invalidateQueries({ queryKey: jobKeys.all });

      if (!vacancyId && saved) {
        router.replace(routes.editVacancy(saved.id));
      } else {
        setMessage({
          tone: 'success',
          text: submitAfterSave ? t('vacancySubmitted') : t('vacancySaved'),
        });
      }
    } catch (e) {
      setMessage({ tone: 'error', text: errorText(e) });
    } finally {
      setBusy(false);
    }
  }

  function onFormSubmit(event: FormEvent) {
    event.preventDefault();
    void save(false);
  }

  const canSubmitForReview =
    !existing ||
    existing.status === 'draft' ||
    existing.status === 'rejected' ||
    existing.status === 'closed';

  return (
    <div className="space-y-6">
      <PageTitle
        title={vacancyId ? t('editVacancy') : t('newVacancy')}
        actions={
          <Link href={routes.sellJobs} className={buttonClass('secondary')}>
            {t('common:back')}
          </Link>
        }
      />

      {existing ? (
        <div className="flex flex-wrap items-center gap-3">
          <VacancyStatusBadge status={existing.status} />
          <span className="text-sm text-text-muted">
            {t(`statusHint.${existing.status}`)}
            {(existing.status === 'rejected' || existing.status === 'hidden') && existing.status_reason
              ? ` ${existing.status_reason}`
              : ''}
          </span>
        </div>
      ) : null}

      <Card className="p-6">
        <form onSubmit={onFormSubmit} className="grid gap-4 md:grid-cols-2">
          <TextField
            label={t('jobTitle')}
            hint={t('jobTitleHint')}
            required
            value={title}
            onChange={(e) => setTitleInput(e.target.value)}
            disabled={busy}
          />

          <TextField
            label={t('companyName')}
            required
            value={companyName}
            onChange={(e) => setCompanyNameInput(e.target.value)}
            disabled={busy}
          />

          <SelectField
            label={t('jobCategory')}
            required
            value={categoryId || ''}
            onChange={(e) => setCategoryIdInput(Number(e.target.value))}
            disabled={busy}
          >
            {jobCategories.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {categoryLabel(cat, language) ?? cat.slug}
              </option>
            ))}
          </SelectField>

          <SelectField
            label={t('jobLocation')}
            required
            value={locationId || ''}
            onChange={(e) => setLocationIdInput(Number(e.target.value))}
            disabled={busy}
          >
            {locations.map((loc) => (
              <option key={loc.id} value={loc.id}>
                {loc.name}
              </option>
            ))}
          </SelectField>

          <SelectField
            label={t('employmentType')}
            required
            value={employmentType}
            onChange={(e) => setEmploymentTypeInput(e.target.value as EmploymentType)}
            disabled={busy}
          >
            {EMPLOYMENT_TYPES.map((type) => (
              <option key={type} value={type}>
                {t(`types.${type}`)}
              </option>
            ))}
          </SelectField>

          <TextField
            label={t('deadlineField')}
            hint={t('deadlineHint')}
            type="date"
            required
            value={deadline}
            onChange={(e) => setDeadlineInput(e.target.value)}
            disabled={busy}
          />

          <TextField
            label={t('salaryMin')}
            inputMode="numeric"
            value={salaryMin}
            onChange={(e) => setSalaryMinInput(e.target.value)}
            disabled={busy}
          />

          <TextField
            label={t('salaryMax')}
            inputMode="numeric"
            value={salaryMax}
            onChange={(e) => setSalaryMaxInput(e.target.value)}
            disabled={busy}
          />

          <div className="md:col-span-2">
            <TextField
              label={t('jobExperience')}
              hint={t('jobExperienceHint')}
              value={experience}
              onChange={(e) => setExperienceInput(e.target.value)}
              disabled={busy}
            />
          </div>

          <div className="md:col-span-2">
            <TextAreaField
              label={t('jobDescription')}
              hint={t('jobDescriptionHint')}
              rows={5}
              required
              value={description}
              onChange={(e) => setDescriptionInput(e.target.value)}
              disabled={busy}
            />
          </div>

          <div className="md:col-span-2">
            <TextAreaField
              label={t('jobRequirements')}
              hint={t('jobRequirementsHint')}
              rows={3}
              value={requirements}
              onChange={(e) => setRequirementsInput(e.target.value)}
              disabled={busy}
            />
          </div>

          {message ? (
            <div className="md:col-span-2">
              <Notice tone={message.tone}>{message.text}</Notice>
            </div>
          ) : null}

          {canSubmitForReview && featuredCredits > 0 && !existing?.is_featured ? (
            <label className="flex min-h-11 items-center gap-3 md:col-span-2">
              <input type="checkbox" className="size-5 accent-primary" checked={preferFeatured} onChange={(e) => setPreferFeatured(e.target.checked)} disabled={busy} />
              <span className="text-sm">{t('preferFeatured')}</span>
            </label>
          ) : null}

          <div className="flex flex-wrap gap-3 md:col-span-2">
            <Button type="submit" variant="secondary" disabled={busy}>
              {busy ? t('common:loading') : existing ? t('saveChanges') : t('saveDraft')}
            </Button>
            {canSubmitForReview ? (
              <Button type="button" disabled={busy} onClick={() => void save(true)}>
                {busy ? t('common:loading') : t('submitForReview')}
              </Button>
            ) : null}
          </div>
        </form>
      </Card>

      {vacancyId ? <VacancyApplicantsSection vacancyId={vacancyId} /> : null}
    </div>
  );
}

function VacancyApplicantsSection({ vacancyId }: { vacancyId: string }) {
  const { t } = useT('jobs');
  const language = useLanguage();
  const applicationsQuery = useVacancyApplications(vacancyId);
  const applications = applicationsQuery.data ?? [];

  return (
    <Card className="p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-bold text-text">{t('applicantsSection')}</h2>
        <span className="text-xs font-medium text-text-muted">
          {t('applicantsCount', { count: applications.length })}
        </span>
      </div>

      {applicationsQuery.isPending ? (
        <div className="mt-4 space-y-3">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      ) : applications.length === 0 ? (
        <p className="mt-3 text-sm text-text-muted">{t('noApplicantsForVacancy')}</p>
      ) : (
        <ul className="mt-4 divide-y divide-border">
          {applications.map((app) => (
            <li key={app.id} className="flex flex-wrap items-center justify-between gap-4 py-3">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-bold text-text">{app.applicant.name}</span>
                  <ApplicationStatusBadge status={app.status} />
                  <span className="text-xs text-text-muted">· {app.number}</span>
                </div>
                {app.applicant.headline ? (
                  <p className="mt-0.5 text-sm text-text">{app.applicant.headline}</p>
                ) : null}
                <p className="mt-0.5 text-xs text-text-muted">
                  {app.cv.title}
                  {app.submitted_at
                    ? ` · ${t('submittedAt', { date: formatDay(app.submitted_at, language) })}`
                    : ''}
                </p>
              </div>
              <Link href={routes.application(app.id)} className={buttonClass('secondary', 'min-h-9 px-3 text-xs')}>
                {t('viewMyApplication')}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
