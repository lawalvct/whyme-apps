'use client';

import Link from 'next/link';
import { useState, type FormEvent } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  jobKeys,
  queryKeys,
  unwrap,
  useApi,
  useEmployerOverview,
  useMyVacancies,
  useTaxonomy,
  useTerms,
  type OwnerVacancy,
} from '@whyme/data';
import { Card, Notice, PageTitle, sellerCapabilities, useErrorText } from '@/components/seller/common';
import { Button, buttonClass } from '@/components/ui/button';
import { CheckboxField, SelectField, TextAreaField, TextField } from '@/components/ui/field';
import { MarketplaceIcon as Icon } from '@/components/ui/MarketplaceIcon';
import { Skeleton } from '@/components/ui/skeleton';
import { routes } from '@/lib/format';
import { useLanguage, useT } from '@/lib/i18n';
import { useAccount } from '@/lib/session';
import { formatSalaryRange, VacancyStatusBadge } from './JobFormat';

export function EmployerCentreView() {
  const { t } = useT('jobs');
  const { user } = useAccount();
  const caps = sellerCapabilities(user);

  if (!caps.employer) {
    return <EnableEmployerCard />;
  }

  return (
    <div className="space-y-8">
      <PageTitle
        title={t('employerCentre')}
        intro={t('employerIntro')}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Link href={routes.applications('employer')} className={buttonClass('secondary')}>
              <span>{t('asEmployer')}</span>
            </Link>
            <Link href={routes.newVacancy} className={buttonClass('primary')}>
              <Icon name="plus" />
              <span>{t('newVacancy')}</span>
            </Link>
          </div>
        }
      />

      <CompanyProfileSection />
      <EmployerVacanciesSection />
    </div>
  );
}

function EnableEmployerCard() {
  const { t } = useT('jobs');
  const { t: tSeller } = useT('seller');
  const language = useLanguage();
  const api = useApi();
  const queryClient = useQueryClient();
  const errorText = useErrorText();
  const terms = useTerms('seller', language);

  const [accepted, setAccepted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  async function onActivate(event: FormEvent) {
    event.preventDefault();
    setProblem(null);
    if (!accepted) {
      setProblem(tSeller('acceptTermsRequired'));
      return;
    }
    if (!terms.data) {
      setProblem(tSeller('termsUnavailable'));
      return;
    }

    setBusy(true);
    try {
      unwrap(
        await api.POST('/v1/me/capabilities', {
          body: { capability: 'employer', terms_version_id: terms.data.id },
        }),
      );
      await queryClient.invalidateQueries({ queryKey: queryKeys.me });
    } catch (e) {
      setProblem(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="mx-auto max-w-2xl space-y-5 p-6">
      <div>
        <h1 className="text-2xl font-bold text-text">{t('enableEmployerTitle')}</h1>
        <p className="mt-1 text-sm text-text-muted">{t('enableEmployerBody')}</p>
      </div>

      <form onSubmit={(e) => void onActivate(e)} className="space-y-4">
        <div>
          <h2 className="mb-2 text-sm font-semibold text-text">{tSeller('termsHeading')}</h2>
          {terms.isPending ? (
            <Skeleton className="h-28 w-full" />
          ) : terms.data ? (
            <div className="max-h-48 overflow-y-auto rounded-xl border border-border bg-bg p-3 text-xs text-text-muted">
              <p className="font-semibold text-text">{terms.data.title}</p>
              <p className="mt-1 whitespace-pre-line">{terms.data.body}</p>
            </div>
          ) : (
            <Notice tone="error">{tSeller('termsUnavailable')}</Notice>
          )}
        </div>

        <CheckboxField
          label={tSeller('acceptTerms')}
          checked={accepted}
          disabled={busy || !terms.data}
          onChange={(e) => setAccepted(e.target.checked)}
        />

        {problem ? <Notice tone="error">{problem}</Notice> : null}

        <Button type="submit" disabled={busy || !terms.data}>
          {busy ? t('common:loading') : t('enableEmployerAction')}
        </Button>
      </form>
    </Card>
  );
}

function CompanyProfileSection() {
  const { t } = useT('jobs');
  const api = useApi();
  const queryClient = useQueryClient();
  const errorText = useErrorText();
  const overview = useEmployerOverview(true);
  const taxonomy = useTaxonomy();

  const profile = overview.data?.profile ?? null;
  const entitlement = overview.data?.entitlement;
  const locations = (taxonomy.data?.locations ?? []).filter((l) => l.type !== 'state');

  const [companyNameInput, setCompanyNameInput] = useState<string | null>(null);
  const [locationIdInput, setLocationIdInput] = useState<number | null>(null);
  const [aboutInput, setAboutInput] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);

  const companyName = companyNameInput ?? profile?.company_name ?? '';
  const locationId = locationIdInput ?? profile?.location_id ?? locations[0]?.id ?? 0;
  const about = aboutInput ?? profile?.about ?? '';

  async function onSave(event: FormEvent) {
    event.preventDefault();
    setMessage(null);
    setBusy(true);
    try {
      unwrap(
        await api.PUT('/v1/me/employer', {
          body: {
            company_name: companyName.trim(),
            location_id: Number(locationId),
            about: about.trim() || null,
            version: profile?.version,
          },
        }),
      );
      setCompanyNameInput(null);
      setLocationIdInput(null);
      setAboutInput(null);
      await queryClient.invalidateQueries({ queryKey: jobKeys.employer() });
      setMessage({ tone: 'success', text: t('companySaved') });
    } catch (e) {
      setMessage({ tone: 'error', text: errorText(e) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      {entitlement ? (
        <Notice tone={entitlement.free_job_available ? 'info' : 'info'}>
          <strong>
            {entitlement.free_job_available
              ? t('freeJobBannerTitle', { days: entitlement.free_term_days })
              : t('freeJobUsedTitle')}
          </strong>
          {' — '}
          {entitlement.free_job_available ? t('freeJobBannerBody') : t('freeJobUsedBody')}
        </Notice>
      ) : null}

      <Card className="p-6">
        <h2 className="text-lg font-bold text-text">{t('companyProfile')}</h2>
        <p className="mt-1 text-sm text-text-muted">{t('companyProfileHint')}</p>

        <form onSubmit={(e) => void onSave(e)} className="mt-4 grid gap-4 md:grid-cols-2">
          <TextField
            label={t('companyName')}
            hint={t('companyNameHint')}
            required
            value={companyName}
            onChange={(e) => setCompanyNameInput(e.target.value)}
            disabled={busy}
          />

          <SelectField
            label={t('companyLocation')}
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

          <div className="md:col-span-2">
            <TextAreaField
              label={t('companyAbout')}
              hint={t('companyAboutHint')}
              rows={3}
              value={about}
              onChange={(e) => setAboutInput(e.target.value)}
              disabled={busy}
            />
          </div>

          {message ? (
            <div className="md:col-span-2">
              <Notice tone={message.tone}>{message.text}</Notice>
            </div>
          ) : null}

          <div className="md:col-span-2">
            <Button type="submit" disabled={busy || companyName.trim().length < 2 || !locationId}>
              {busy ? t('common:loading') : t('saveCompany')}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}

function EmployerVacanciesSection() {
  const { t } = useT('jobs');
  const api = useApi();
  const queryClient = useQueryClient();
  const errorText = useErrorText();
  const vacancies = useMyVacancies();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);

  async function onClose(vacancy: OwnerVacancy) {
    setProblem(null);
    setBusyId(vacancy.id);
    try {
      unwrap(
        await api.POST('/v1/me/vacancies/{vacancy}/close', {
          params: { path: { vacancy: vacancy.id } },
          body: { version: vacancy.version },
        }),
      );
      await queryClient.invalidateQueries({ queryKey: jobKeys.all });
    } catch (e) {
      setProblem(errorText(e));
    } finally {
      setBusyId(null);
    }
  }

  async function onDelete(vacancy: OwnerVacancy) {
    if (!window.confirm(t('deleteConfirm', { title: vacancy.title }))) return;
    setProblem(null);
    setBusyId(vacancy.id);
    try {
      const { error, response } = await api.DELETE('/v1/me/vacancies/{vacancy}', {
        params: { path: { vacancy: vacancy.id } },
      });
      if (!response.ok) throw error;
      await queryClient.invalidateQueries({ queryKey: jobKeys.all });
    } catch (e) {
      setProblem(errorText(e));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <Card className="p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-bold text-text">{t('yourVacancies')}</h2>
        <Link href={routes.newVacancy} className={buttonClass('secondary', 'min-h-9 px-3 text-xs')}>
          <Icon name="plus" />
          <span>{t('newVacancy')}</span>
        </Link>
      </div>

      {problem ? <Notice tone="error" className="mt-4">{problem}</Notice> : null}

      {vacancies.isPending ? (
        <div className="mt-4 space-y-3">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
      ) : vacancies.data && vacancies.data.length > 0 ? (
        <ul className="mt-4 divide-y divide-border">
          {vacancies.data.map((vacancy) => (
            <li key={vacancy.id} className="flex flex-wrap items-center justify-between gap-4 py-4">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <VacancyStatusBadge status={vacancy.status} />
                  <span className="text-xs font-medium text-text-muted">
                    {t(`types.${vacancy.employment_type}`)}
                  </span>
                  <span className="text-xs text-text-muted">· {vacancy.location.name}</span>
                  <span className="text-xs font-semibold text-primary-pressed">
                    · {t('applicantsCount', { count: vacancy.applications_count })}
                  </span>
                </div>
                <h3 className="mt-1 text-base font-bold text-text">{vacancy.title}</h3>
                <p className="mt-0.5 text-xs text-text-muted">
                  {formatSalaryRange(vacancy.salary_min_kobo, vacancy.salary_max_kobo, t)}
                  {vacancy.deadline_at
                    ? ` · ${t('deadlineDate', { date: new Date(vacancy.deadline_at).toLocaleDateString() })}`
                    : ''}
                </p>
                <p className="mt-1 text-xs text-text-muted">
                  {t(`statusHint.${vacancy.status}`)}
                  {(vacancy.status === 'rejected' || vacancy.status === 'hidden') && vacancy.status_reason
                    ? ` ${vacancy.status_reason}`
                    : ''}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Link href={routes.editVacancy(vacancy.id)} className={buttonClass('secondary', 'min-h-9 px-3 text-xs')}>
                  {t('seller:edit')}
                </Link>
                {vacancy.status === 'published' ? (
                  <Link href={routes.job(vacancy)} className={buttonClass('ghost', 'min-h-9 px-3 text-xs')}>
                    {t('seller:viewPage')}
                  </Link>
                ) : null}
                {(vacancy.status === 'published' || vacancy.status === 'pending_review') ? (
                  <Button
                    type="button"
                    variant="secondary"
                    className="min-h-9 px-3 text-xs"
                    disabled={busyId === vacancy.id}
                    onClick={() => void onClose(vacancy)}
                  >
                    {t('closeVacancy')}
                  </Button>
                ) : null}
                <Button
                  type="button"
                  variant="ghost"
                  className="min-h-9 px-3 text-xs text-danger"
                  disabled={busyId === vacancy.id}
                  onClick={() => void onDelete(vacancy)}
                >
                  {t('deleteVacancy')}
                </Button>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-4 text-sm text-text-muted">{t('noVacancies')}</p>
      )}
    </Card>
  );
}
