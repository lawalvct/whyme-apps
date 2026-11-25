'use client';

import type { ApplicationStatus, EmploymentType, VacancyStatus } from '@whyme/data';
import { Badge } from '@/components/ui/badge';
import { formatNaira } from '@/lib/format';
import { useT } from '@/lib/i18n';

export const EMPLOYMENT_TYPES: EmploymentType[] = [
  'full_time',
  'part_time',
  'temporary',
  'internship',
  'apprenticeship',
  'contract',
];

const statusTones: Record<VacancyStatus, 'neutral' | 'primary' | 'accent' | 'warning'> = {
  draft: 'neutral',
  pending_review: 'accent',
  published: 'primary',
  rejected: 'warning',
  closed: 'neutral',
  expired: 'neutral',
  hidden: 'warning',
};

export function VacancyStatusBadge({ status }: { status: VacancyStatus }) {
  const { t } = useT('jobs');
  return <Badge tone={statusTones[status]}>{t(`status.${status}`)}</Badge>;
}

const applicationStatusTones: Record<ApplicationStatus, 'neutral' | 'primary' | 'accent' | 'warning'> = {
  held: 'accent',
  applied: 'neutral',
  reviewing: 'accent',
  shortlisted: 'primary',
  accepted: 'primary',
  rejected: 'warning',
  refused: 'warning',
  withdrawn: 'neutral',
};

export function ApplicationStatusBadge({ status }: { status: ApplicationStatus }) {
  const { t } = useT('jobs');
  return <Badge tone={applicationStatusTones[status]}>{t(`applicationStatus.${status}`)}</Badge>;
}

export function formatSalaryRange(
  minKobo: number | null | undefined,
  maxKobo: number | null | undefined,
  t: (key: string, values?: Record<string, unknown>) => string,
): string {
  const hasMin = minKobo !== null && minKobo !== undefined && minKobo > 0;
  const hasMax = maxKobo !== null && maxKobo !== undefined && maxKobo > 0;
  if (hasMin && hasMax) {
    if (minKobo === maxKobo) return `${formatNaira(minKobo)} / month`;
    return t('salaryRange', { min: formatNaira(minKobo), max: formatNaira(maxKobo) });
  }
  if (hasMin) return t('salaryFrom', { min: formatNaira(minKobo) });
  if (hasMax) return t('salaryUpTo', { max: formatNaira(maxKobo) });
  return t('salaryNotStated');
}
