'use client';

import { categoryLabel, useTaxonomy } from '@whyme/data';
import { useLanguage } from '@/lib/i18n';

/**
 * A category's name in the reader's language. Server HTML has the English name
 * (`fallback`); the taxonomy has every language, so it switches on the client.
 */
export function CategoryName({ id, fallback }: { id: number; fallback?: string | null }) {
  const language = useLanguage();
  const { data } = useTaxonomy();
  const category = data?.categories.find((c) => c.id === id);
  return <>{categoryLabel(category, language) ?? fallback ?? ''}</>;
}
