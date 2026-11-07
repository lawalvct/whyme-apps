'use client';

import { useT } from '@/lib/i18n';

/** Keep contact and payment on WHY ME (SAF01, COM01). */
export function SafetyNote() {
  const { t } = useT('market');
  return (
    <aside className="rounded-xl border border-accent bg-accent-soft p-4 text-sm text-text">
      <p className="font-semibold">{t('safetyTitle')}</p>
      <p className="mt-1">{t('safetyBody')}</p>
    </aside>
  );
}
