'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  chatKeys,
  jobKeys,
  unwrap,
  useApi,
  useApplication,
} from '@whyme/data';
import { Card, Notice, useErrorText } from '@/components/seller/common';
import { Badge } from '@/components/ui/badge';
import { Button, buttonClass } from '@/components/ui/button';
import { TextAreaField } from '@/components/ui/field';
import { MarketplaceIcon as Icon } from '@/components/ui/MarketplaceIcon';
import { Skeleton } from '@/components/ui/skeleton';
import { routes } from '@/lib/format';
import { useT } from '@/lib/i18n';
import { ApplicationStatusBadge, formatSalaryRange } from './JobFormat';

type TransitionName = 'review' | 'shortlist' | 'accept' | 'reject' | 'withdraw';

export function ApplicationDetailView({ applicationId }: { applicationId: string }) {
  const { t } = useT('jobs');
  const router = useRouter();
  const api = useApi();
  const queryClient = useQueryClient();
  const errorText = useErrorText();

  const appQuery = useApplication(applicationId);
  const app = appQuery.data;

  const [noteInput, setNoteInput] = useState('');
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);

  if (appQuery.isPending) {
    return (
      <div className="mx-auto max-w-4xl space-y-4 px-4 py-8">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full rounded-2xl" />
      </div>
    );
  }

  if (!app) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-12 text-center">
        <h1 className="text-2xl font-bold text-text">{t('market:notFoundTitle')}</h1>
        <Link href={routes.applications()} className={buttonClass('primary', 'mt-6')}>
          {t('backToApplications')}
        </Link>
      </div>
    );
  }

  const isEmployer = app.role === 'employer';
  const vacancy = app.vacancy;
  const cvUrl = app.cv.download_url;

  async function onTransition(action: TransitionName) {
    if (!app) return;
    if (action === 'withdraw') {
      const confirmed = window.confirm(
        t('withdrawConfirm', { title: vacancy?.title ?? app.number }),
      );
      if (!confirmed) return;
    }

    setProblem(null);
    setBusyAction(action);
    try {
      const pathMap = {
        review: '/v1/me/applications/{application}/review',
        shortlist: '/v1/me/applications/{application}/shortlist',
        accept: '/v1/me/applications/{application}/accept',
        reject: '/v1/me/applications/{application}/reject',
        withdraw: '/v1/me/applications/{application}/withdraw',
      } as const;

      unwrap(
        await api.POST(pathMap[action], {
          params: { path: { application: app.id } },
          body: {
            version: app.version,
            note: noteInput.trim() || null,
          },
        }),
      );
      setNoteInput('');
      await queryClient.invalidateQueries({ queryKey: jobKeys.all });
    } catch (e) {
      setProblem(errorText(e));
    } finally {
      setBusyAction(null);
    }
  }

  async function onOpenChat() {
    if (!app) return;
    setProblem(null);
    setBusyAction('chat');
    try {
      const conv = unwrap(
        await api.POST('/v1/conversations', {
          body: {
            subject_type: 'job_application',
            subject_id: app.id,
          },
        }),
      ).data;
      await queryClient.invalidateQueries({ queryKey: chatKeys.all });
      router.push(routes.conversation(conv.id));
    } catch (e) {
      setProblem(errorText(e));
    } finally {
      setBusyAction(null);
    }
  }

  const canEmployerReview = isEmployer && app.status === 'applied';
  const canEmployerShortlist = isEmployer && (app.status === 'applied' || app.status === 'reviewing');
  const canEmployerDecide =
    isEmployer &&
    (app.status === 'applied' || app.status === 'reviewing' || app.status === 'shortlisted');
  const canApplicantWithdraw =
    !isEmployer &&
    (app.status === 'held' ||
      app.status === 'applied' ||
      app.status === 'reviewing' ||
      app.status === 'shortlisted');

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 py-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href={routes.applications(isEmployer ? 'employer' : undefined)}
          className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
        >
          <Icon name="chevron" className="rotate-90" />
          <span>{t('backToApplications')}</span>
        </Link>

        {app.status !== 'held' ? (
          <Button
            type="button"
            variant="secondary"
            disabled={busyAction !== null}
            onClick={() => void onOpenChat()}
          >
            <Icon name="message" />
            <span>{isEmployer ? t('messageApplicant') : t('messageEmployer')}</span>
          </Button>
        ) : null}
      </div>

      <Card className="space-y-4 p-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <ApplicationStatusBadge status={app.status} />
            <span className="text-xs font-medium text-text-muted">{app.number}</span>
          </div>
          {vacancy ? (
            <Link href={routes.job(vacancy)} className="text-xs font-semibold text-primary hover:underline">
              {vacancy.title} · {vacancy.company_name}
            </Link>
          ) : null}
        </div>

        <div>
          <h1 className="text-2xl font-bold text-text">
            {isEmployer ? app.applicant.name : (vacancy?.title ?? app.number)}
          </h1>
          {!isEmployer ? (
            <p className="mt-1 text-sm text-text-muted">
              {t(`applicationStatusHint.${app.status}`)}
            </p>
          ) : null}
        </div>

        {vacancy ? (
          <div className="flex flex-wrap gap-3 text-xs text-text-muted">
            <span>{t(`types.${vacancy.employment_type}`)}</span>
            {vacancy.location.name ? <span>· {vacancy.location.name}</span> : null}
            <span>· {formatSalaryRange(vacancy.salary_min_kobo, vacancy.salary_max_kobo, t)}</span>
          </div>
        ) : null}

        <div className="flex flex-wrap gap-4 border-t border-border pt-3 text-xs text-text-muted">
          {app.client_created_at ? (
            <span>{t('preparedOfflineAt', { date: new Date(app.client_created_at).toLocaleString() })}</span>
          ) : null}
          {app.submitted_at ? (
            <span>{t('submittedAt', { date: new Date(app.submitted_at).toLocaleString() })}</span>
          ) : null}
        </div>

        {app.status_note ? (
          <Notice tone="info">{app.status_note}</Notice>
        ) : null}
      </Card>

      <div className="grid gap-6 md:grid-cols-2">
        <Card className="space-y-3 p-6">
          <h2 className="text-base font-bold text-text">{t('attachedCv')}</h2>
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-bg p-4">
            <div>
              <p className="font-semibold text-text">{app.cv.title}</p>
              <p className="mt-0.5 text-xs text-text-muted">
                {t(`cvSource.${app.cv.source}`)} · {Math.max(1, Math.round(app.cv.size_bytes / 1024))} KB
              </p>
            </div>
            <a
              href={cvUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={buttonClass('primary', 'min-h-9 px-3 text-xs')}
            >
              {t('openCv')}
            </a>
          </div>

          {app.cover_note ? (
            <div className="pt-2">
              <h3 className="text-sm font-bold text-text">{t('coverNote')}</h3>
              <p className="mt-1 whitespace-pre-line text-sm text-text">{app.cover_note}</p>
            </div>
          ) : null}
        </Card>

        <Card className="space-y-3 p-6">
          <h2 className="text-base font-bold text-text">{t('applicantProfile')}</h2>
          <p className="font-semibold text-text">{app.applicant.name}</p>
          {app.applicant.headline ? (
            <p className="text-sm text-text-muted">{app.applicant.headline}</p>
          ) : null}
          {app.applicant.location_name ? (
            <p className="text-xs text-text-muted">{app.applicant.location_name}</p>
          ) : null}
          {app.applicant.bio ? (
            <p className="whitespace-pre-line text-sm text-text">{app.applicant.bio}</p>
          ) : null}
          {app.applicant.skills.length > 0 ? (
            <div className="flex flex-wrap gap-1.5 pt-1">
              {app.applicant.skills.map((skill) => (
                <Badge key={skill} tone="neutral">{skill}</Badge>
              ))}
            </div>
          ) : null}
        </Card>
      </div>

      {canEmployerDecide || canApplicantWithdraw ? (
        <Card className="space-y-4 p-6">
          {isEmployer ? (
            <>
              <TextAreaField
                label={t('employerNoteLabel')}
                hint={t('employerNoteHint')}
                rows={2}
                value={noteInput}
                onChange={(e) => setNoteInput(e.target.value)}
                disabled={busyAction !== null}
              />

              {problem ? <Notice tone="error">{problem}</Notice> : null}

              <div className="flex flex-wrap gap-2">
                {canEmployerReview ? (
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={busyAction !== null}
                    onClick={() => void onTransition('review')}
                  >
                    {t('markReviewing')}
                  </Button>
                ) : null}
                {canEmployerShortlist ? (
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={busyAction !== null}
                    onClick={() => void onTransition('shortlist')}
                  >
                    {t('shortlistApplicant')}
                  </Button>
                ) : null}
                <Button
                  type="button"
                  disabled={busyAction !== null}
                  onClick={() => void onTransition('accept')}
                >
                  {t('acceptApplicant')}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  className="text-danger"
                  disabled={busyAction !== null}
                  onClick={() => void onTransition('reject')}
                >
                  {t('rejectApplicant')}
                </Button>
              </div>
            </>
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-3">
              {problem ? <Notice tone="error" className="w-full">{problem}</Notice> : null}
              <Button
                type="button"
                variant="ghost"
                className="text-danger"
                disabled={busyAction !== null}
                onClick={() => void onTransition('withdraw')}
              >
                {t('withdrawApplication')}
              </Button>
            </div>
          )}
        </Card>
      ) : null}

      {app.events && app.events.length > 0 ? (
        <Card className="p-6">
          <h2 className="text-base font-bold text-text">{t('timelineTitle')}</h2>
          <ol className="mt-3 space-y-2 text-xs text-text-muted">
            {app.events.map((ev, idx) => (
              <li key={idx} className="flex flex-wrap items-center gap-2">
                <span className="font-semibold text-text">
                  {t(`applicationStatus.${ev.to}`)}
                </span>
                {ev.at ? <span>· {new Date(ev.at).toLocaleString()}</span> : null}
                {ev.note ? <span className="text-text">({ev.note})</span> : null}
              </li>
            ))}
          </ol>
        </Card>
      ) : null}
    </div>
  );
}
