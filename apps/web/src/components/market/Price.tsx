'use client';

import { formatNaira } from '@/lib/format';
import { useT } from '@/lib/i18n';

/** Products show their price; services show an indicative "From …" (the quote sets the charge, LST05). */
export function Price({ kobo, kind, className }: { kobo: number | null; kind: string; className?: string }) {
  const { t } = useT('market');
  if (kobo === null) return <span className={className}>{t('priceOnRequest')}</span>;
  const amount = formatNaira(kobo);
  return <span className={className}>{kind === 'service' ? t('fromPrice', { price: amount }) : amount}</span>;
}
