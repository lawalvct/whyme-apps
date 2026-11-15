'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState, type ChangeEvent, type FormEvent } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  isConnectionError,
  isRetryable,
  jobKeys,
  unwrap,
  useApi,
  useApplications,
  useMyCvs,
  usePublicVacancy,
  type Cv,
  type PublicVacancy,
} from '@whyme/data';
import { errorKey } from '@whyme/i18n';
import { VerifiedBadge } from '@/components/market/VerifiedBadge';
import { Notice, useErrorText } from '@/components/seller/common';
import { Badge } from '@/components/ui/badge';
import { Button, buttonClass } from '@/components/ui/button';
import { SelectField, TextAreaField } from '@/components/ui/field';
import { MarketplaceIcon as Icon } from '@/components/ui/MarketplaceIcon';
import { Skeleton } from '@/components/ui/skeleton';
import {
  discardQueuedApplication,
  queueJobApplication,
  useQueuedApplications,
  type ApplicationQueuePayload,
} from '@/lib/application-queue';
import { routes } from '@/lib/format';
import { useLanguage, useT } from '@/lib/i18n';
import { useAccountRuntime } from '@/lib/offline';
import { useAccount } from '@/lib/session';
import { uploadCvDocument, waitForUpload } from '@/lib/uploads';
import { ApplicationStatusBadge, formatSalaryRange } from './JobFormat';

export function JobDetailView({ slugOrId }: { slugOrId: string }) {
  const { t } = useT('jobs');
  const router = useRouter();
  const vacancyQuery = usePublicVacancy(slugOrId);
  const job = vacancyQuery.data;

  useEffect(() => {
    if (job && job.slug && job.slug !== slugOrId) {
      router.replace(routes.job(job));
    }
  }, [job, slugOrId, router]);

  if (vacancyQuery.isPending) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-8">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="mt-4 h-64 w-full rounded-2xl" />
      </div>
    );
  }

  if (!job) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-12 text-center">
        <h1 className="text-2xl font-bold text-text">{t('market:notFoundTitle')}</h1>
        <p className="mt-2 text-text-muted">{t('market:notFoundBody')}</p>
        <Link href={routes.jobs()} className={buttonClass('primary', 'mt-6')}>
          {t('backToJobs')}
        </Link>
      </div>
    );
  }

  const salary = formatSalaryRange(job.salary_min_kobo, job.salary_max_kobo, t);
  const deadline = job.deadline_at ? new Date(job.deadline_at).toLocaleDateString() : null;

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <Link href={routes.jobs()} className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">
          <Icon name="chevron" className="rotate-90" />
          <span>{t('backToJobs')}</span>
        </Link>
        <div className="flex flex-wrap items-center gap-2">
          <Link href={routes.applications()} className={buttonClass('ghost', 'min-h-9 px-3 text-xs')}>
            {t('myApplications')}
          </Link>
          <Link href={routes.seekerProfile} className={buttonClass('secondary', 'min-h-9 px-3 text-xs')}>
            {t('mySeekerProfile')}
          </Link>
        </div>
      </div>

      <article className="rounded-2xl border border-border bg-surface p-6 shadow-xs">
        <header className="border-b border-border pb-6">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="primary">{t(`types.${job.employment_type}`)}</Badge>
            <Badge tone={job.is_open ? 'primary' : 'warning'}>
              {t(job.is_open ? 'openForApplications' : 'closedForApplications')}
            </Badge>
            {job.category.name ? (
              <span className="text-xs font-medium text-text-muted">{job.category.name}</span>
            ) : null}
          </div>

          <h1 className="mt-3 text-2xl font-bold text-text md:text-3xl">{job.title}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-text-muted">
            <span className="font-semibold text-text">{job.employer.company_name}</span>
            {job.employer.verified ? <VerifiedBadge /> : null}
            <span className="inline-flex items-center gap-1">
              <Icon name="pin" className="size-4 text-primary" />
              {job.location.name}
            </span>
          </div>

          <dl className="mt-5 grid gap-4 rounded-xl bg-bg p-4 sm:grid-cols-3">
            <div>
              <dt className="text-xs text-text-muted">{t('salary')}</dt>
              <dd className="mt-0.5 font-semibold text-primary-pressed">{salary}</dd>
            </div>
            {deadline ? (
              <div>
                <dt className="text-xs text-text-muted">{t('deadline')}</dt>
                <dd className="mt-0.5 font-semibold text-text">{deadline}</dd>
              </div>
            ) : null}
            {job.experience ? (
              <div>
                <dt className="text-xs text-text-muted">{t('experienceNeeded')}</dt>
                <dd className="mt-0.5 font-semibold text-text">{job.experience}</dd>
              </div>
            ) : null}
          </dl>
        </header>

        <div className="mt-6 space-y-6">
          <section>
            <h2 className="text-lg font-bold text-text">{t('aboutRole')}</h2>
            <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-text">{job.description}</p>
          </section>

          {job.requirements ? (
            <section>
              <h2 className="text-lg font-bold text-text">{t('requirements')}</h2>
              <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-text">{job.requirements}</p>
            </section>
          ) : null}

          {job.employer.about ? (
            <section className="rounded-xl border border-border p-4">
              <h2 className="text-base font-bold text-text">{t('aboutEmployer')}</h2>
              <p className="mt-1 whitespace-pre-line text-sm text-text-muted">{job.employer.about}</p>
            </section>
          ) : null}

          <JobApplySection job={job} />
        </div>
      </article>
    </div>
  );
}

function JobApplySection({ job }: { job: PublicVacancy }) {
  const { t } = useT('jobs');
  const { t: tSync } = useT('sync');
  const language = useLanguage();
  const router = useRouter();
  const api = useApi();
  const queryClient = useQueryClient();
  const errorText = useErrorText();
  const sync = useAccountRuntime();
  const { status: authStatus } = useAccount();
  const isSignedIn = authStatus === 'signed_in';

  const existingAppsQuery = useApplications('applicant', undefined, job.id, isSignedIn);
  const cvsQuery = useMyCvs(isSignedIn);
  const queuedApps = useQueuedApplications(job.id);

  const existingApp = existingAppsQuery.data?.[0] ?? null;
  const queuedApp = queuedApps?.[0] ?? null;
  const queuedPayload = queuedApp?.payload as ApplicationQueuePayload | undefined;
  const cvs = cvsQuery.data ?? [];
  const defaultCv = cvs.find((c) => c.is_default) ?? cvs[0] ?? null;

  const [selectedCvId, setSelectedCvId] = useState<string | null>(null);
  const [cvFile, setCvFile] = useState<File | null>(null);
  const [coverNote, setCoverNote] = useState('');
  const [editingQueued, setEditingQueued] = useState(false);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  const activeCvId = selectedCvId ?? queuedPayload?.cv_id ?? defaultCv?.id ?? '';

  function onFilePicked(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    event.target.value = '';
    if (file) setCvFile(file);
  }

  function startEditQueued() {
    if (queuedPayload) {
      setCoverNote(queuedPayload.cover_note ?? '');
      if (queuedPayload.cv_id) setSelectedCvId(queuedPayload.cv_id);
    }
    setEditingQueued(true);
  }

  async function enqueueOffline(clientCreatedAt: string) {
    if (!sync) return false;
    const selectedCv = cvs.find((c) => c.id === activeCvId) ?? null;
    await queueJobApplication(sync, {
      vacancy_id: job.id,
      vacancy_slug: job.slug,
      vacancy_title: job.title,
      company_name: job.employer.company_name,
      cv_id: cvFile ? null : activeCvId || null,
      cv_title: cvFile ? cvFile.name : (selectedCv?.title ?? queuedPayload?.cv_title ?? 'CV'),
      cvFile,
      cover_note: coverNote.trim() || null,
      client_created_at: clientCreatedAt,
    });
    setEditingQueued(false);
    setCvFile(null);
    return true;
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!activeCvId && !cvFile) return;
    setProblem(null);
    setBusy(true);

    const clientCreatedAt = queuedPayload?.client_created_at ?? new Date().toISOString();

    if (!navigator.onLine && sync) {
      try {
        await enqueueOffline(clientCreatedAt);
      } finally {
        setBusy(false);
      }
      return;
    }

    try {
      let finalCvId = activeCvId;
      if (cvFile) {
        const uploadClientId =
          typeof crypto !== 'undefined' && 'randomUUID' in crypto
            ? crypto.randomUUID()
            : `cv-${Date.now()}`;
        const uploaded = await uploadCvDocument(cvFile, uploadClientId);
        const processed =
          uploaded.status === 'processing' ? await waitForUpload(api, uploaded.id) : uploaded;
        const attached = (
          unwrap(
            await api.POST('/v1/me/cvs/upload', {
              body: {
                upload_id: processed.id,
                title: cvFile.name.replace(/\.(pdf|docx)$/i, '').slice(0, 120) || 'Uploaded CV',
              },
            }),
          ) as unknown as { data: Cv }
        ).data;
        finalCvId = attached.id;
      }

      const created = unwrap(
        await api.POST('/v1/jobs/{vacancy}/apply', {
          params: { path: { vacancy: job.id } },
          body: {
            ...(queuedPayload?.client_id ? { client_id: queuedPayload.client_id } : {}),
            cv_id: finalCvId,
            cover_note: coverNote.trim() || null,
            client_created_at: clientCreatedAt,
          },
        }),
      ).data;
      if (queuedApp && sync) {
        await discardQueuedApplication(sync, queuedApp.actionId);
      }
      await queryClient.invalidateQueries({ queryKey: jobKeys.all });
      router.push(routes.application(created.id));
    } catch (e) {
      if (sync && (isConnectionError(e) || isRetryable(e)) && (await enqueueOffline(clientCreatedAt))) {
        return;
      }
      setProblem(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  const queuedRefused = queuedApp?.state === 'rejected';
  const queuedError = queuedApp?.lastErrorCode ? t(errorKey(queuedApp.lastErrorCode)) : null;
  const queuedTime = queuedPayload?.client_created_at
    ? new Intl.DateTimeFormat(language === 'ig' ? 'ig-NG' : 'en-NG', {
        dateStyle: 'medium',
        timeStyle: 'short',
      }).format(new Date(queuedPayload.client_created_at))
    : '';

  return (
    <section className="rounded-xl border border-primary/25 bg-primary-soft/40 p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="flex items-center gap-2 text-base font-bold text-text">
            <Icon name="shield" className="text-primary" />
            <span>{t('inAppApplication')}</span>
          </h2>
          <p className="mt-1 text-sm text-text-muted">{t('inAppApplicationHint')}</p>
        </div>
        <Link href={routes.seekerProfile} className={buttonClass('secondary', 'min-h-9 px-3 text-xs')}>
          {t('mySeekerProfile')}
        </Link>
      </div>

      {!isSignedIn ? (
        <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-border pt-4">
          {job.is_open ? (
            <Link href={routes.signIn(routes.job(job))} className={buttonClass('primary')}>
              {t('signInToApply')}
            </Link>
          ) : (
            <span className="text-sm font-medium text-text-muted">{t('closedForApplications')}</span>
          )}
        </div>
      ) : existingAppsQuery.isPending || cvsQuery.isPending ? (
        <Skeleton className="mt-4 h-24 w-full" />
      ) : existingApp ? (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-surface p-4">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-bold text-text">{t('alreadyAppliedTitle')}</span>
              <ApplicationStatusBadge status={existingApp.status} />
            </div>
            <p className="text-xs text-text-muted">{t(`applicationStatusHint.${existingApp.status}`)}</p>
          </div>
          <Link href={routes.application(existingApp.id)} className={buttonClass('primary')}>
            {t('viewMyApplication')}
          </Link>
        </div>
      ) : queuedApp && !editingQueued ? (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-4 rounded-xl border-2 border-dashed border-accent bg-surface p-4">
          <div className="min-w-0 flex-1 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={queuedRefused ? 'warning' : 'accent'}>
                {queuedRefused ? tSync('item.attention') : tSync('savedOffline')}
              </Badge>
              {queuedTime ? (
                <span className="text-xs text-text-muted">
                  {tSync('createdOffline', { time: queuedTime })}
                </span>
              ) : null}
            </div>
            <p className="text-sm font-bold text-text">{t('queuedApplicationTitle')}</p>
            {queuedPayload?.cv_title ? (
              <p className="text-xs text-text-muted">
                {t('attachedCv')}: {queuedPayload.cv_title}
              </p>
            ) : null}
            {queuedPayload?.cover_note ? (
              <p className="whitespace-pre-line text-xs text-text-muted">
                {queuedPayload.cover_note}
              </p>
            ) : null}
            {queuedError ? (
              <p role="alert" className="text-xs font-medium text-danger">
                {queuedError}
              </p>
            ) : null}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {job.is_open ? (
              <Button
                type="button"
                variant="secondary"
                className="min-h-9 px-3 text-xs"
                onClick={startEditQueued}
              >
                {t('editQueuedApplication')}
              </Button>
            ) : null}
            {sync ? (
              <Button
                type="button"
                variant="ghost"
                className="min-h-9 px-3 text-xs text-danger"
                onClick={() => void discardQueuedApplication(sync, queuedApp.actionId)}
              >
                {t('discardQueuedApplication')}
              </Button>
            ) : null}
          </div>
        </div>
      ) : !job.is_open ? (
        <p className="mt-4 border-t border-border pt-4 text-sm font-medium text-text-muted">
          {t('closedForApplications')}
        </p>
      ) : (
        <form onSubmit={(e) => void onSubmit(e)} className="mt-4 space-y-4 border-t border-border pt-4">
          {cvs.length > 0 && !cvFile ? (
            <SelectField
              label={t('chooseCvLabel')}
              required={!cvFile}
              value={activeCvId}
              onChange={(e) => setSelectedCvId(e.target.value)}
              disabled={busy}
            >
              {cvs.map((cv) => (
                <option key={cv.id} value={cv.id}>
                  {cv.title} ({t(`cvSource.${cv.source}`)})
                </option>
              ))}
            </SelectField>
          ) : cvs.length === 0 && !cvFile ? (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-surface p-3">
              <p className="text-xs text-text-muted">{t('needCvBeforeApply')}</p>
              <Link href={routes.seekerProfile} className={buttonClass('secondary', 'min-h-8 px-3 text-xs')}>
                {t('createOrUploadCv')}
              </Link>
            </div>
          ) : null}

          <div className="flex flex-wrap items-center gap-3">
            {cvFile ? (
              <>
                <span className="text-xs font-semibold text-text">
                  {t('selectedCvFile', { name: cvFile.name })}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  className="min-h-8 px-2 text-xs"
                  onClick={() => setCvFile(null)}
                  disabled={busy}
                >
                  {t('clearSelectedCvFile')}
                </Button>
              </>
            ) : (
              <label className={buttonClass('secondary', 'min-h-9 cursor-pointer px-3 text-xs')}>
                <input
                  type="file"
                  accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                  className="sr-only"
                  disabled={busy}
                  onChange={onFilePicked}
                />
                <span>{t('uploadNewCvForApplication')}</span>
              </label>
            )}
          </div>

          <TextAreaField
            label={t('coverNoteLabel')}
            hint={t('coverNoteHint')}
            rows={3}
            value={coverNote}
            onChange={(e) => setCoverNote(e.target.value)}
            disabled={busy}
          />

          {problem ? <Notice tone="error">{problem}</Notice> : null}

          <Button type="submit" disabled={busy || (!activeCvId && !cvFile)}>
            {busy ? t('common:loading') : t('submitApplication')}
          </Button>
        </form>
      )}
    </section>
  );
}
