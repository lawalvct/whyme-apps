'use client';

import { Badge } from '@/components/ui/badge';
import { useT } from '@/lib/i18n';

/** Documents checked by WHY ME (TRU01). Green, never gold: gold is for featured items only. */
export function VerifiedBadge() {
  const { t } = useT('market');
  return (
    <Badge tone="primary">
      <svg aria-hidden viewBox="0 0 20 20" className="size-3.5 fill-current">
        <path d="M10 1.5l2.4 1.7 2.9-.2.9 2.8 2.4 1.7-.9 2.8.9 2.8-2.4 1.7-.9 2.8-2.9-.2L10 18.5l-2.4-1.7-2.9.2-.9-2.8L1.4 12.5l.9-2.8-.9-2.8 2.4-1.7.9-2.8 2.9.2L10 1.5zm-1.2 11.8l5-5-1.2-1.2-3.8 3.8-1.8-1.8L5.8 10.3l3 3z" />
      </svg>
      <span title={t('verifiedHint')}>{t('verified')}</span>
    </Badge>
  );
}
