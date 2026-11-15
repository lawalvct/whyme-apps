'use client';

import type { ComponentProps, ReactNode } from 'react';
import { ApiRequestError, type ListingStatus, type Me, type OwnerProfile } from '@whyme/data';
import { errorKey } from '@whyme/i18n';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/components/ui/cn';
import { useT } from '@/lib/i18n';
import styles from './SellerWorkspace.module.css';

type Status = ListingStatus | OwnerProfile['status'];

const tones: Record<Status, 'neutral' | 'primary' | 'accent' | 'warning'> = {
  draft: 'neutral',
  pending_review: 'accent',
  published: 'primary',
  paused: 'neutral',
  rejected: 'warning',
  hidden: 'warning',
  expired: 'neutral',
  removed: 'neutral',
};

export function StatusBadge({ status }: { status: Status }) {
  const { t } = useT('seller');
  return <Badge tone={tones[status]}>{t(`status.${status}`)}</Badge>;
}

/** What the status means for the seller, with the moderator's reason when there is one. */
export function StatusNote({ status, reason }: { status: Status; reason: string | null | undefined }) {
  const { t } = useT('seller');
  const needsReason = status === 'rejected' || status === 'hidden';
  return (
    <p className={cn('text-sm', needsReason ? 'text-warning' : 'text-text-muted')}>
      {t(`statusHint.${status}`)}
      {needsReason ? <> {reason?.trim() || t('noReason')}</> : null}
    </p>
  );
}

type NoticeTone = 'success' | 'info' | 'error';

const noticeTones: Record<NoticeTone, string> = {
  success: 'border-primary/30 bg-primary-soft text-primary-pressed',
  info: 'border-accent/40 bg-accent-soft text-accent-text',
  error: 'border-danger/30 bg-surface text-danger',
};

/** A message after an action. Errors interrupt screen readers; the rest are polite. */
export function Notice({ tone, children, className }: { tone: NoticeTone; children: ReactNode; className?: string }) {
  return (
    <p role={tone === 'error' ? 'alert' : 'status'} className={cn('rounded-lg border p-3 text-sm', noticeTones[tone], className)}>
      {children}
    </p>
  );
}

/** Which seller capabilities this account has switched on (ACC07). */
export function sellerCapabilities(user: Me | null): { vendor: boolean; provider: boolean; employer: boolean } {
  const active = new Set(
    (user?.capabilities ?? []).filter((c) => c.status === 'active').map((c) => c.capability),
  );
  return { vendor: active.has('vendor'), provider: active.has('provider'), employer: active.has('employer') };
}

/** The translated message for a failed request, by the API's error code. */
export function useErrorText() {
  const { t } = useT('errors');
  return (error: unknown, values?: Record<string, unknown>) =>
    t(errorKey(error instanceof ApiRequestError ? error.code : 'network_error'), values);
}

/** The current record from a 409 conflict body (docs/01 §5.6), if the API sent one. */
export function conflictRecord<T>(error: unknown): T | null {
  if (!(error instanceof ApiRequestError) || error.status !== 409) return null;
  const body = error.body as { data?: T } | null;
  return body?.data ?? null;
}

export function PageTitle({ title, intro, actions }: { title: string; intro?: ReactNode; actions?: ReactNode }) {
  return (
    <header className={styles.pageTitle}>
      <div className="min-w-0">
        <h1 className="text-2xl font-bold">{title}</h1>
        {intro ? <p className="mt-1 max-w-2xl text-text-muted">{intro}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </header>
  );
}

export function Card({ children, className, ...props }: ComponentProps<'section'>) {
  return <section className={cn(styles.card, className)} {...props}>{children}</section>;
}

export function SectionTitle({ number, title, hint }: { number: string; title: string; hint?: string }) {
  return <header className={styles.sectionTitle}><span>{number}</span><div><h2>{title}</h2>{hint && <p>{hint}</p>}</div></header>;
}
