'use client';

import Link from 'next/link';
import { useState, type FormEvent } from 'react';
import {
  categoryLabel,
  usePublicVacancies,
  useTaxonomy,
  type EmploymentType,
  type PublicVacancy,
} from '@whyme/data';
import { VerifiedBadge } from '@/components/market/VerifiedBadge';
import { Badge } from '@/components/ui/badge';
import { Button, buttonClass } from '@/components/ui/button';
import { SelectField, TextField } from '@/components/ui/field';
import { MarketplaceIcon as Icon } from '@/components/ui/MarketplaceIcon';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDay, routes } from '@/lib/format';
import { useLanguage, useT } from '@/lib/i18n';
import { EMPLOYMENT_TYPES, formatSalaryRange } from './JobFormat';

export function JobsBrowseView() {
  const { t } = useT('jobs');
  const language = useLanguage();
  const taxonomy = useTaxonomy();

  const [searchInput, setSearchInput] = useState('');
  const [appliedQuery, setAppliedQuery] = useState<string | undefined>(undefined);
  const [categoryId, setCategoryId] = useState<number | undefined>(undefined);
  const [locationId, setLocationId] = useState<number | undefined>(undefined);
  const [employmentType, setEmploymentType] = useState<EmploymentType | undefined>(undefined);

  const vacancies = usePublicVacancies({
    q: appliedQuery,
    category_id: categoryId,
    location_id: locationId,
    employment_type: employmentType,
  });

  const jobCategories = (taxonomy.data?.categories ?? []).filter((c) => c.type === 'job');
  const locations = (taxonomy.data?.locations ?? []).filter((l) => l.type !== 'state');

  function onSearchSubmit(event: FormEvent) {
    event.preventDefault();
    const trimmed = searchInput.trim();
    setAppliedQuery(trimmed === '' ? undefined : trimmed);
  }

  function clearFilters() {
    setSearchInput('');
    setAppliedQuery(undefined);
    setCategoryId(undefined);
    setLocationId(undefined);
    setEmploymentType(undefined);
  }

  const hasFilters =
    Boolean(appliedQuery) ||
    categoryId !== undefined ||
    locationId !== undefined ||
    employmentType !== undefined;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <header className="mb-8 flex flex-wrap items-end justify-between gap-4 border-b border-border pb-6">
        <div>
          <h1 className="text-3xl font-bold text-text">{t('jobsTitle')}</h1>
          <p className="mt-2 max-w-2xl text-text-muted">{t('jobsSubtitle')}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link href={routes.applications()} className={buttonClass('ghost')}>
            <span>{t('myApplications')}</span>
          </Link>
          <Link href={routes.seekerProfile} className={buttonClass('secondary')}>
            <span>{t('mySeekerProfile')}</span>
          </Link>
          <Link href={routes.sellJobs} className={buttonClass('primary')}>
            <Icon name="plus" />
            <span>{t('postAJob')}</span>
          </Link>
        </div>
      </header>

      <section className="mb-8 rounded-2xl border border-border bg-surface p-4 shadow-xs">
        <form onSubmit={onSearchSubmit} className="grid items-end gap-3 md:grid-cols-4">
          <div className="flex items-end gap-2 md:col-span-2">
            <TextField
              type="search"
              label={t('jobsTitle')}
              className="flex-1"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder={t('searchPlaceholder')}
            />
            <Button type="submit" variant="secondary">
              <Icon name="search" />
            </Button>
          </div>

          <SelectField
            label={t('jobCategory')}
            value={categoryId ?? ''}
            onChange={(e) => setCategoryId(e.target.value ? Number(e.target.value) : undefined)}
          >
            <option value="">{t('allCategories')}</option>
            {jobCategories.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {categoryLabel(cat, language) ?? cat.slug}
              </option>
            ))}
          </SelectField>

          <SelectField
            label={t('jobLocation')}
            value={locationId ?? ''}
            onChange={(e) => setLocationId(e.target.value ? Number(e.target.value) : undefined)}
          >
            <option value="">{t('allLocations')}</option>
            {locations.map((loc) => (
              <option key={loc.id} value={loc.id}>
                {loc.name}
              </option>
            ))}
          </SelectField>
        </form>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
          <div className="flex flex-wrap gap-2" role="group" aria-label={t('employmentType')}>
            <button
              type="button"
              onClick={() => setEmploymentType(undefined)}
              className={buttonClass(employmentType === undefined ? 'primary' : 'ghost', 'min-h-9 px-3 text-xs')}
            >
              {t('allTypes')}
            </button>
            {EMPLOYMENT_TYPES.map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => setEmploymentType(type)}
                className={buttonClass(employmentType === type ? 'primary' : 'ghost', 'min-h-9 px-3 text-xs')}
              >
                {t(`types.${type}`)}
              </button>
            ))}
          </div>

          {hasFilters ? (
            <button
              type="button"
              onClick={clearFilters}
              className="text-sm font-medium text-primary hover:underline"
            >
              {t('clearFilters')}
            </button>
          ) : null}
        </div>
      </section>

      {vacancies.isPending ? (
        <div className="grid gap-4 md:grid-cols-2">
          <Skeleton className="h-44 w-full rounded-2xl" />
          <Skeleton className="h-44 w-full rounded-2xl" />
          <Skeleton className="h-44 w-full rounded-2xl" />
          <Skeleton className="h-44 w-full rounded-2xl" />
        </div>
      ) : vacancies.data && vacancies.data.length > 0 ? (
        <ul className="grid gap-4 md:grid-cols-2">
          {vacancies.data.map((job) => (
            <li key={job.id}>
              <JobCard job={job} />
            </li>
          ))}
        </ul>
      ) : (
        <div className="rounded-2xl border border-border bg-surface p-10 text-center">
          <h2 className="text-lg font-semibold text-text">{t('noJobsFound')}</h2>
          <p className="mt-1 text-sm text-text-muted">{t('noJobsHint')}</p>
          {hasFilters ? (
            <Button type="button" variant="secondary" className="mt-4" onClick={clearFilters}>
              {t('clearFilters')}
            </Button>
          ) : null}
        </div>
      )}
    </div>
  );
}

/** One open job: also used in the marketplace search's Jobs tab. */
export function JobCard({ job }: { job: PublicVacancy }) {
  const { t } = useT('jobs');
  const language = useLanguage();
  const salary = formatSalaryRange(job.salary_min_kobo, job.salary_max_kobo, t);
  const deadline = job.deadline_at ? formatDay(job.deadline_at, language) : null;

  return (
    <Link
      href={routes.job(job)}
      className="flex h-full flex-col justify-between rounded-2xl border border-border bg-surface p-5 transition hover:border-primary/50 hover:shadow-sm"
    >
      <div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Badge tone="primary">{t(`types.${job.employment_type}`)}</Badge>
          {job.category.name ? (
            <span className="text-xs font-medium text-text-muted">{job.category.name}</span>
          ) : null}
        </div>

        <h2 className="mt-3 text-lg font-bold text-text">{job.title}</h2>
        <div className="mt-1 flex flex-wrap items-center gap-2 text-sm font-medium text-text-muted">
          <span>{job.employer.company_name}</span>
          {job.employer.verified ? <VerifiedBadge /> : null}
        </div>

        <p className="mt-3 line-clamp-2 text-sm text-text-muted">{job.description}</p>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3 text-xs text-text-muted">
        <span className="inline-flex items-center gap-1 font-medium text-text">
          <Icon name="pin" className="size-4 text-primary" />
          {job.location.name}
        </span>
        <span className="font-semibold text-primary-pressed">{salary}</span>
        {deadline ? <span>{t('deadlineDate', { date: deadline })}</span> : null}
      </div>
    </Link>
  );
}
