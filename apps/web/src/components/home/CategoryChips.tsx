'use client';

import Link from 'next/link';
import type { TaxonomyCategory } from '@whyme/data';
import { routes } from '@/lib/format';
import { useT } from '@/lib/i18n';
import { CategoryName } from '@/components/market/CategoryName';

/** Service categories (LST01): one tap to the providers in that trade. */
export function CategoryChips({ categories }: { categories: TaxonomyCategory[] }) {
  const { t } = useT('market');
  if (categories.length === 0) return null;
  return (
    <section className="mt-10">
      <h2 className="mb-4 text-xl font-bold text-text">{t('findAService')}</h2>
      <ul className="flex flex-wrap gap-2">
        {categories.map((category) => (
          <li key={category.id}>
            <Link
              href={routes.search({ type: 'people', kind: 'provider', category_id: category.id })}
              className="inline-flex min-h-11 items-center rounded-full border border-border px-4 text-sm font-medium text-text hover:border-primary hover:bg-primary-soft hover:text-primary-pressed"
            >
              <CategoryName id={category.id} fallback={String(category.name.en ?? category.slug)} />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
