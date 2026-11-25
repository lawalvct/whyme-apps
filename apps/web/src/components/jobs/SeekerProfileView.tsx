'use client';

import Link from 'next/link';
import { useState, type ChangeEvent, type FormEvent } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  jobKeys,
  unwrap,
  useApi,
  useSeekerOverview,
  useTaxonomy,
  type Cv,
} from '@whyme/data';
import { Card, Notice, PageTitle, useErrorText } from '@/components/seller/common';
import { Badge } from '@/components/ui/badge';
import { Button, buttonClass } from '@/components/ui/button';
import { CheckboxField, SelectField, TextAreaField, TextField } from '@/components/ui/field';
import { MarketplaceIcon as Icon } from '@/components/ui/MarketplaceIcon';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDay, routes } from '@/lib/format';
import { useLanguage, useT } from '@/lib/i18n';
import { uploadCvDocument, waitForUpload } from '@/lib/uploads';

interface ExperienceItem {
  role: string;
  company: string;
  period: string;
  summary: string;
}

interface EducationItem {
  qualification: string;
  institution: string;
  year: string;
}

export function SeekerProfileView() {
  const { t } = useT('jobs');
  const overview = useSeekerOverview(true);

  if (overview.isPending) {
    return (
      <div className="mx-auto max-w-4xl space-y-6 px-4 py-8">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-80 w-full rounded-2xl" />
        <Skeleton className="h-64 w-full rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-8 px-4 py-8">
      <PageTitle
        title={t('seekerProfileTitle')}
        intro={t('seekerProfileSubtitle')}
        actions={
          <Link href={routes.jobs()} className={buttonClass('secondary')}>
            {t('backToJobs')}
          </Link>
        }
      />

      <SeekerProfileForm />
      <SeekerCvsSection />
    </div>
  );
}

function SeekerProfileForm() {
  const { t } = useT('jobs');
  const api = useApi();
  const queryClient = useQueryClient();
  const errorText = useErrorText();
  const overview = useSeekerOverview(true);
  const taxonomy = useTaxonomy();

  const profile = overview.data?.profile ?? null;
  const locations = (taxonomy.data?.locations ?? []).filter((l) => l.type !== 'state');

  const [headlineInput, setHeadlineInput] = useState<string | null>(null);
  const [locationIdInput, setLocationIdInput] = useState<number | null>(null);
  const [bioInput, setBioInput] = useState<string | null>(null);
  const [skillsInput, setSkillsInput] = useState<string | null>(null);
  const [experienceInput, setExperienceInput] = useState<ExperienceItem[] | null>(null);
  const [educationInput, setEducationInput] = useState<EducationItem[] | null>(null);
  const [discoverableInput, setDiscoverableInput] = useState<boolean | null>(null);

  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);

  const headline = headlineInput ?? profile?.headline ?? '';
  const locationId = locationIdInput ?? profile?.location_id ?? locations[0]?.id ?? 0;
  const bio = bioInput ?? profile?.bio ?? '';
  const skillsText = skillsInput ?? (profile?.skills ?? []).join(', ');
  const experience: ExperienceItem[] =
    experienceInput ??
    (profile?.experience ?? []).map((e) => ({
      role: e.role,
      company: e.company,
      period: e.period,
      summary: e.summary ?? '',
    }));
  const education: EducationItem[] =
    educationInput ??
    (profile?.education ?? []).map((ed) => ({
      qualification: ed.qualification,
      institution: ed.institution,
      year: ed.year,
    }));
  const discoverable = discoverableInput ?? profile?.discoverable ?? false;

  function addExperience() {
    setExperienceInput([...experience, { role: '', company: '', period: '', summary: '' }]);
  }

  function updateExperience(index: number, patch: Partial<ExperienceItem>) {
    setExperienceInput(
      experience.map((item, idx) => (idx === index ? { ...item, ...patch } : item)),
    );
  }

  function removeExperience(index: number) {
    setExperienceInput(experience.filter((_, idx) => idx !== index));
  }

  function addEducation() {
    setEducationInput([...education, { qualification: '', institution: '', year: '' }]);
  }

  function updateEducation(index: number, patch: Partial<EducationItem>) {
    setEducationInput(
      education.map((item, idx) => (idx === index ? { ...item, ...patch } : item)),
    );
  }

  function removeEducation(index: number) {
    setEducationInput(education.filter((_, idx) => idx !== index));
  }

  async function onSave(event: FormEvent) {
    event.preventDefault();
    setMessage(null);
    setBusy(true);

    const parsedSkills = skillsText
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    const cleanedExperience = experience
      .filter((e) => e.role.trim() && e.company.trim() && e.period.trim())
      .map((e) => ({
        role: e.role.trim(),
        company: e.company.trim(),
        period: e.period.trim(),
        summary: e.summary.trim() || null,
      }));

    const cleanedEducation = education
      .filter((ed) => ed.qualification.trim() && ed.institution.trim() && ed.year.trim())
      .map((ed) => ({
        qualification: ed.qualification.trim(),
        institution: ed.institution.trim(),
        year: ed.year.trim(),
      }));

    try {
      unwrap(
        await api.PUT('/v1/me/seeker', {
          body: {
            version: profile?.version,
            location_id: locationId ? Number(locationId) : null,
            headline: headline.trim() || null,
            bio: bio.trim() || null,
            skills: parsedSkills,
            experience: cleanedExperience,
            education: cleanedEducation,
            discoverable,
          },
        }),
      );
      setHeadlineInput(null);
      setLocationIdInput(null);
      setBioInput(null);
      setSkillsInput(null);
      setExperienceInput(null);
      setEducationInput(null);
      setDiscoverableInput(null);
      await queryClient.invalidateQueries({ queryKey: jobKeys.seeker() });
      setMessage({ tone: 'success', text: t('seekerProfileSaved') });
    } catch (e) {
      setMessage({ tone: 'error', text: errorText(e) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="p-6">
      <h2 className="text-lg font-bold text-text">{t('seekerProfileSection')}</h2>
      <p className="mt-1 text-sm text-text-muted">{t('seekerProfileHint')}</p>

      <form onSubmit={(e) => void onSave(e)} className="mt-5 space-y-6">
        <div className="grid gap-4 md:grid-cols-2">
          <TextField
            label={t('headlineField')}
            hint={t('headlineHint')}
            value={headline}
            onChange={(e) => setHeadlineInput(e.target.value)}
            disabled={busy}
          />

          <SelectField
            label={t('jobLocation')}
            value={locationId || ''}
            onChange={(e) => setLocationIdInput(Number(e.target.value))}
            disabled={busy}
          >
            <option value="">{t('chooseLocation')}</option>
            {locations.map((loc) => (
              <option key={loc.id} value={loc.id}>
                {loc.name}
              </option>
            ))}
          </SelectField>

          <div className="md:col-span-2">
            <TextAreaField
              label={t('bioField')}
              hint={t('bioHint')}
              rows={4}
              value={bio}
              onChange={(e) => setBioInput(e.target.value)}
              disabled={busy}
            />
          </div>

          <div className="md:col-span-2">
            <TextField
              label={t('skillsField')}
              hint={t('skillsHint')}
              value={skillsText}
              onChange={(e) => setSkillsInput(e.target.value)}
              disabled={busy}
            />
          </div>
        </div>

        <div className="space-y-3 border-t border-border pt-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-bold text-text">{t('experienceSection')}</h3>
            <Button type="button" variant="secondary" className="min-h-9 px-3 text-xs" onClick={addExperience} disabled={busy}>
              <Icon name="plus" />
              <span>{t('addExperience')}</span>
            </Button>
          </div>

          {experience.map((item, idx) => (
            <div key={idx} className="space-y-3 rounded-xl border border-border bg-bg p-4">
              <div className="grid gap-3 md:grid-cols-3">
                <TextField
                  label={t('expRole')}
                  required
                  value={item.role}
                  onChange={(e) => updateExperience(idx, { role: e.target.value })}
                  disabled={busy}
                />
                <TextField
                  label={t('expCompany')}
                  required
                  value={item.company}
                  onChange={(e) => updateExperience(idx, { company: e.target.value })}
                  disabled={busy}
                />
                <TextField
                  label={t('expPeriod')}
                  required
                  value={item.period}
                  onChange={(e) => updateExperience(idx, { period: e.target.value })}
                  disabled={busy}
                />
              </div>
              <TextAreaField
                label={t('expSummary')}
                rows={2}
                value={item.summary}
                onChange={(e) => updateExperience(idx, { summary: e.target.value })}
                disabled={busy}
              />
              <div>
                <Button type="button" variant="ghost" className="min-h-8 px-2 text-xs text-danger" onClick={() => removeExperience(idx)} disabled={busy}>
                  {t('removeEntry')}
                </Button>
              </div>
            </div>
          ))}
        </div>

        <div className="space-y-3 border-t border-border pt-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-bold text-text">{t('educationSection')}</h3>
            <Button type="button" variant="secondary" className="min-h-9 px-3 text-xs" onClick={addEducation} disabled={busy}>
              <Icon name="plus" />
              <span>{t('addEducation')}</span>
            </Button>
          </div>

          {education.map((item, idx) => (
            <div key={idx} className="space-y-3 rounded-xl border border-border bg-bg p-4">
              <div className="grid gap-3 md:grid-cols-3">
                <TextField
                  label={t('eduQualification')}
                  required
                  value={item.qualification}
                  onChange={(e) => updateEducation(idx, { qualification: e.target.value })}
                  disabled={busy}
                />
                <TextField
                  label={t('eduInstitution')}
                  required
                  value={item.institution}
                  onChange={(e) => updateEducation(idx, { institution: e.target.value })}
                  disabled={busy}
                />
                <TextField
                  label={t('eduYear')}
                  required
                  value={item.year}
                  onChange={(e) => updateEducation(idx, { year: e.target.value })}
                  disabled={busy}
                />
              </div>
              <div>
                <Button type="button" variant="ghost" className="min-h-8 px-2 text-xs text-danger" onClick={() => removeEducation(idx)} disabled={busy}>
                  {t('removeEntry')}
                </Button>
              </div>
            </div>
          ))}
        </div>

        <div className="border-t border-border pt-4">
          <CheckboxField
            label={t('discoverableLabel')}
            checked={discoverable}
            disabled={busy}
            onChange={(e) => setDiscoverableInput(e.target.checked)}
          />
          <p className="mt-1 text-xs text-text-muted">{t('discoverableHint')}</p>
        </div>

        {message ? <Notice tone={message.tone}>{message.text}</Notice> : null}

        <Button type="submit" disabled={busy}>
          {busy ? t('common:loading') : t('saveSeekerProfile')}
        </Button>
      </form>
    </Card>
  );
}

function SeekerCvsSection() {
  const { t } = useT('jobs');
  const language = useLanguage();
  const api = useApi();
  const queryClient = useQueryClient();
  const errorText = useErrorText();
  const overview = useSeekerOverview(true);

  const cvs = overview.data?.cvs ?? [];
  const [cvLocale, setCvLocale] = useState<'en' | 'ig'>('en');
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [message, setMessage] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);

  async function onGenerateCv() {
    setMessage(null);
    setBusyAction('generate');
    try {
      unwrap(
        await api.POST('/v1/me/cvs/generate', {
          body: { locale: cvLocale, is_default: true },
        }),
      );
      await queryClient.invalidateQueries({ queryKey: jobKeys.all });
      setMessage({ tone: 'success', text: t('cvGenerated') });
    } catch (e) {
      setMessage({ tone: 'error', text: errorText(e) });
    } finally {
      setBusyAction(null);
    }
  }

  async function onFileSelected(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    setMessage(null);
    setBusyAction('upload');
    try {
      const clientId = typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `cv-${Date.now()}`;

      const uploaded = await uploadCvDocument(file, clientId);
      const processed = uploaded.status === 'processing'
        ? await waitForUpload(api, uploaded.id)
        : uploaded;

      unwrap(
        await api.POST('/v1/me/cvs/upload', {
          body: {
            upload_id: processed.id,
            title: file.name.replace(/\.(pdf|docx)$/i, ''),
          },
        }),
      );
      await queryClient.invalidateQueries({ queryKey: jobKeys.all });
      setMessage({ tone: 'success', text: t('cvUploaded') });
    } catch (e) {
      setMessage({ tone: 'error', text: errorText(e) });
    } finally {
      setBusyAction(null);
    }
  }

  async function onSetDefault(cv: Cv) {
    setMessage(null);
    setBusyAction(cv.id);
    try {
      unwrap(
        await api.POST('/v1/me/cvs/{cv}/default', {
          params: { path: { cv: cv.id } },
        }),
      );
      await queryClient.invalidateQueries({ queryKey: jobKeys.all });
    } catch (e) {
      setMessage({ tone: 'error', text: errorText(e) });
    } finally {
      setBusyAction(null);
    }
  }

  async function onDelete(cv: Cv) {
    if (!window.confirm(t('deleteCvConfirm', { title: cv.title }))) return;
    setMessage(null);
    setBusyAction(cv.id);
    try {
      const { error, response } = await api.DELETE('/v1/me/cvs/{cv}', {
        params: { path: { cv: cv.id } },
      });
      if (!response.ok) throw error;
      await queryClient.invalidateQueries({ queryKey: jobKeys.all });
    } catch (e) {
      setMessage({ tone: 'error', text: errorText(e) });
    } finally {
      setBusyAction(null);
    }
  }

  return (
    <Card className="space-y-6 p-6">
      <div>
        <h2 className="text-lg font-bold text-text">{t('cvsSection')}</h2>
        <p className="mt-1 text-sm text-text-muted">{t('cvsHint')}</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="flex flex-col justify-between rounded-xl border border-border bg-bg p-4">
          <div>
            <h3 className="text-sm font-bold text-text">{t('generateCvTitle')}</h3>
            <p className="mt-1 text-xs text-text-muted">{t('generateCvBody')}</p>
          </div>
          <div className="mt-4 space-y-3">
            <SelectField
              label={t('cvHeadingLanguage')}
              value={cvLocale}
              onChange={(e) => setCvLocale(e.target.value as 'en' | 'ig')}
              disabled={busyAction !== null}
            >
              <option value="en">{t('cvLanguageEn')}</option>
              <option value="ig">{t('cvLanguageIg')}</option>
            </SelectField>
            <Button type="button" onClick={() => void onGenerateCv()} disabled={busyAction !== null}>
              {busyAction === 'generate' ? t('common:loading') : t('generateCvButton')}
            </Button>
          </div>
        </div>

        <div className="flex flex-col justify-between rounded-xl border border-border bg-bg p-4">
          <div>
            <h3 className="text-sm font-bold text-text">{t('uploadCvTitle')}</h3>
            <p className="mt-1 text-xs text-text-muted">{t('uploadCvBody')}</p>
          </div>
          <div className="mt-4">
            <label className={buttonClass('secondary', 'cursor-pointer')}>
              <input
                type="file"
                accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                className="sr-only"
                disabled={busyAction !== null}
                onChange={(e) => void onFileSelected(e)}
              />
              <span>{busyAction === 'upload' ? t('uploadingCv') : t('chooseCvFile')}</span>
            </label>
          </div>
        </div>
      </div>

      {message ? <Notice tone={message.tone}>{message.text}</Notice> : null}

      {cvs.length > 0 ? (
        <ul className="divide-y divide-border">
          {cvs.map((cv) => (
            <li key={cv.id} className="flex flex-wrap items-center justify-between gap-4 py-4">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-bold text-text">{cv.title}</span>
                  {cv.is_default ? <Badge tone="primary">{t('defaultCvBadge')}</Badge> : null}
                  <Badge tone="neutral">{t(`cvSource.${cv.source}`)}</Badge>
                </div>
                <p className="mt-1 text-xs text-text-muted">
                  {cv.extension.toUpperCase()} · {Math.max(1, Math.round(cv.size_bytes / 1024))} KB
                  {cv.created_at ? ` · ${formatDay(cv.created_at, language)}` : ''}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <a
                  href={cv.download_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={buttonClass('secondary', 'min-h-9 px-3 text-xs')}
                >
                  {t('previewDownloadCv')}
                </a>
                {!cv.is_default ? (
                  <Button
                    type="button"
                    variant="secondary"
                    className="min-h-9 px-3 text-xs"
                    disabled={busyAction !== null}
                    onClick={() => void onSetDefault(cv)}
                  >
                    {t('setDefaultCv')}
                  </Button>
                ) : null}
                <Button
                  type="button"
                  variant="ghost"
                  className="min-h-9 px-3 text-xs text-danger"
                  disabled={busyAction !== null}
                  onClick={() => void onDelete(cv)}
                >
                  {t('deleteCv')}
                </Button>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-text-muted">{t('noCvsYet')}</p>
      )}
    </Card>
  );
}
