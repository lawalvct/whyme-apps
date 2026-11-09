'use client';

import { cn } from '@/components/ui/cn';
import { useT } from '@/lib/i18n';

/** A seller's returns terms: approved by WHY ME, or as an order kept them. */
export interface ReturnsTerms {
  accepts_returns: boolean;
  return_days: number | null;
  conditions: string | null;
}

/**
 * The seller's returns policy, shown only once WHY ME approved it (an order keeps the one the
 * buyer saw). WHY ME protection applies either way, so nothing shows when there is none.
 */
export function ReturnsPolicy({ terms, label, className }: { terms: ReturnsTerms | null | undefined; label?: string; className?: string }) {
  const { t } = useT('market');
  if (!terms) return null;
  return (
    <p className={cn('text-sm', className)}>
      <span className="font-semibold">{label ?? t('returns.label')}: </span>
      {terms.accepts_returns ? t('returns.within', { count: terms.return_days ?? 0 }) : t('returns.none')}
      {terms.conditions ? <span className="text-text-muted"> · {terms.conditions}</span> : null}
    </p>
  );
}
