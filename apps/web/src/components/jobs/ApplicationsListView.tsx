'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { jobKeys, useApplications, useOfflineCopy, type JobApplication } from '@whyme/data';
import { errorKey } from '@whyme/i18n';
import type { OutboxAction } from '@whyme/sync';
import { Card } from '@/components/seller/common';
import { Badge } from '@/components/ui/badge';
import { Button, buttonClass } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  discardQueuedApplication,
  useQueuedApplications,
  type ApplicationQueuePayload,
} from '@/lib/application-queue';
import { routes } from '@/lib/format';
import { useLanguage, useT } from '@/lib/i18n';
import { useAccountRuntime } from '@/lib/offline';
import { ApplicationStatusBadge, formatSalaryRange } from './JobFormat';

export function ApplicationsListView() {
  const { t } = useT('jobs');
  const { t: tSync } = useT('sync');
  const language = useLanguage();
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
  const initialRole = searchParams.get('tab') === 'employer' ? 'employer' : 'applicant';
  const [role, setRole] = useState<'applicant' | 'employer'>(initialRole);

  const applicationsQuery = useApplications(role);
  const applications = applicationsQuery.data ?? [];
  const queued = useQueuedApplications();
  const queuedForTab = role === 'applicant' ? (queued ?? []) : [];
  const copyAt = useOfflineCopy('jobs', `applications:${role}:all:all`);

  const queuedKey = (queued ?? []).map((a) => `${a.actionId}:${a.state}`).join(',');
  useEffect(() => {
    void queryClient.invalidateQueries({ queryKey: jobKeys.all });
  }, [queuedKey, queryClient]);

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-8">
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-border pb-6">
        <div>
          <h1 className="text-3xl font-bold text-text">{t('myApplicationsTitle')}</h1>
          <p className="mt-1 text-sm text-text-muted">{t('myApplicationsSubtitle')}</p>
          {copyAt ? (
            <p role="status" className="mt-3 inline-flex items-center gap-2 rounded-xl bg-accent-soft px-3 py-1.5 text-xs font-semibold text-accent-text">
              {tSync('offlineCopy', {
                time: new Intl.DateTimeFormat(language === 'ig' ? 'ig-NG' : 'en-NG', {
                  dateStyle: 'medium',
                  timeStyle: 'short',
                }).format(new Date(copyAt)),
              })}
            </p>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link href={routes.seekerProfile} className={buttonClass('secondary')}>
            {t('mySeekerProfile')}
          </Link>
          <Link href={routes.jobs()} className={buttonClass('primary')}>
            {t('browseJobs')}
          </Link>
        </div>
      </header>

      <div className="flex flex-wrap gap-2" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={role === 'applicant'}
          onClick={() => setRole('applicant')}
          className={buttonClass(role === 'applicant' ? 'primary' : 'secondary')}
        >
          {t('asApplicant')}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={role === 'employer'}
          onClick={() => setRole('employer')}
          className={buttonClass(role === 'employer' ? 'primary' : 'secondary')}
        >
          {t('asEmployer')}
        </button>
      </div>

      {queuedForTab.length > 0 ? (
        <ul className="space-y-3">
          {queuedForTab.map((action) => (
            <QueuedApplicationCard key={action.actionId} action={action} />
          ))}
        </ul>
      ) : null}

      {applicationsQuery.isPending ? (
        <div className="space-y-3">
          <Skeleton className="h-24 w-full rounded-2xl" />
          <Skeleton className="h-24 w-full rounded-2xl" />
        </div>
      ) : applications.length === 0 && queuedForTab.length === 0 ? (
        <Card className="p-8 text-center">
          <p className="text-sm text-text-muted">
            {role === 'applicant' ? t('noApplicationsYet') : t('noEmployerApplicationsYet')}
          </p>
        </Card>
      ) : applications.length > 0 ? (
        <ul className="space-y-3">
          {applications.map((app) => (
            <li key={app.id}>
              <ApplicationCard app={app} role={role} />
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function QueuedApplicationCard({ action }: { action: OutboxAction }) {
  const { t } = useT('jobs');
  const { t: tSync } = useT('sync');
  const language = useLanguage();
  const sync = useAccountRuntime();

  const payload = action.payload as ApplicationQueuePayload;
  const refused = action.state === 'rejected';
  const errorMessage = action.lastErrorCode ? t(errorKey(action.lastErrorCode)) : null;
  const createdTime = new Intl.DateTimeFormat(language === 'ig' ? 'ig-NG' : 'en-NG', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(payload.client_created_at));

  return (
    <li className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border-2 border-dashed border-accent bg-surface p-5">
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={refused ? 'warning' : 'accent'}>
            {refused ? tSync('item.attention') : tSync('savedOffline')}
          </Badge>
          <span className="text-xs text-text-muted">
            {tSync('createdOffline', { time: createdTime })}
          </span>
        </div>

        <h2 className="text-lg font-bold text-text">{payload.vacancy_title}</h2>
        <p className="text-sm text-text-muted">
          {payload.company_name} · {t('attachedCv')}: {payload.cv_title}
        </p>

        {payload.cover_note ? (
          <p className="line-clamp-2 text-xs text-text-muted">{payload.cover_note}</p>
        ) : null}

        {errorMessage ? (
          <p role="alert" className="text-xs font-medium text-danger">
            {errorMessage}
          </p>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Link
          href={routes.job({ id: payload.vacancy_id, slug: payload.vacancy_slug })}
          className={buttonClass('secondary', 'min-h-9 px-3 text-xs')}
        >
          {t('editQueuedApplication')}
        </Link>
        {sync ? (
          <Button
            type="button"
            variant="ghost"
            className="min-h-9 px-3 text-xs text-danger"
            onClick={() => void discardQueuedApplication(sync, action.actionId)}
          >
            {t('discardQueuedApplication')}
          </Button>
        ) : null}
      </div>
    </li>
  );
}

function ApplicationCard({ app, role }: { app: JobApplication; role: 'applicant' | 'employer' }) {
  const { t } = useT('jobs');
  const vacancy = app.vacancy;
  const salary = vacancy
    ? formatSalaryRange(vacancy.salary_min_kobo, vacancy.salary_max_kobo, t)
    : null;
  const preparedOffline =
    app.client_created_at &&
    app.submitted_at &&
    Math.abs(new Date(app.submitted_at).getTime() - new Date(app.client_created_at).getTime()) > 60_000;

  return (
    <Link
      href={routes.application(app.id)}
      className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-border bg-surface p-5 transition hover:border-primary/50 hover:shadow-xs"
    >
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <ApplicationStatusBadge status={app.status} />
          <span className="text-xs font-medium text-text-muted">{app.number}</span>
          {preparedOffline && app.client_created_at ? (
            <span className="text-xs text-text-muted">
              · {t('preparedOfflineAt', { date: new Date(app.client_created_at).toLocaleDateString() })}
            </span>
          ) : null}
          {app.submitted_at ? (
            <span className="text-xs text-text-muted">
              · {t('submittedAt', { date: new Date(app.submitted_at).toLocaleDateString() })}
            </span>
          ) : null}
        </div>

        <h2 className="text-lg font-bold text-text">
          {role === 'employer'
            ? `${app.applicant.name} — ${vacancy?.title ?? ''}`
            : (vacancy?.title ?? app.number)}
        </h2>

        <p className="text-sm text-text-muted">
          {role === 'employer' ? (
            <>
              {app.applicant.headline ? `${app.applicant.headline} · ` : ''}
              {app.cv.title}
            </>
          ) : (
            <>
              {vacancy?.company_name}
              {vacancy?.location.name ? ` · ${vacancy.location.name}` : ''}
              {salary ? ` · ${salary}` : ''}
            </>
          )}
        </p>
      </div>

      <span className={buttonClass('secondary', 'min-h-9 px-3 text-xs')}>
        {t('viewMyApplication')}
      </span>
    </Link>
  );
}
