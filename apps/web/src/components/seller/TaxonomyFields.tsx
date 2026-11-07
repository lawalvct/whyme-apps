'use client';

import { forwardRef, type SelectHTMLAttributes } from 'react';
import { categoryLabel, useTaxonomy, type TaxonomyLocation } from '@whyme/data';
import { CheckboxField, FieldGroup, SelectField } from '@/components/ui/field';
import { useLanguage, useT } from '@/lib/i18n';

type SelectProps = SelectHTMLAttributes<HTMLSelectElement> & { label: string; hint?: string; error?: string };

/** Active categories of one type (product or service), in the reader's language. */
export const CategorySelect = forwardRef<HTMLSelectElement, SelectProps & { type: 'product' | 'service' }>(function CategorySelect(
  { type, ...props },
  ref,
) {
  const { t } = useT('seller');
  const language = useLanguage();
  const { data } = useTaxonomy();
  const all = data?.categories ?? [];
  const byId = new Map(all.map((c) => [c.id, c]));
  const options = all
    .filter((c) => c.type === type)
    .map((c) => {
      const parent = c.parent_id ? byId.get(c.parent_id) : undefined;
      const name = categoryLabel(c, language) ?? c.slug;
      return { id: c.id, label: parent ? `${categoryLabel(parent, language)} › ${name}` : name };
    })
    .sort((a, b) => a.label.localeCompare(b.label));

  return (
    <SelectField ref={ref} {...props}>
      <option value="">{t('chooseCategory')}</option>
      {options.map((o) => (
        <option key={o.id} value={o.id}>
          {o.label}
        </option>
      ))}
    </SelectField>
  );
});

function lgasWithAreas(locations: readonly TaxonomyLocation[]) {
  const lgas = locations.filter((l) => l.type === 'lga').sort((a, b) => a.name.localeCompare(b.name));
  return lgas.map((lga) => ({
    lga,
    areas: locations.filter((l) => l.type === 'area' && l.parent_id === lga.id).sort((a, b) => a.name.localeCompare(b.name)),
  }));
}

/** An LGA, or an area inside one when the admin has added areas (UX05). */
export const LocationSelect = forwardRef<HTMLSelectElement, SelectProps>(function LocationSelect(props, ref) {
  const { t } = useT('seller');
  const { data } = useTaxonomy();
  const groups = lgasWithAreas(data?.locations ?? []);

  return (
    <SelectField ref={ref} {...props}>
      <option value="">{t('chooseLocation')}</option>
      {groups.map(({ lga, areas }) =>
        areas.length === 0 ? (
          <option key={lga.id} value={lga.id}>
            {lga.name}
          </option>
        ) : (
          <optgroup key={lga.id} label={lga.name}>
            <option value={lga.id}>{t('wholeLga', { name: lga.name })}</option>
            {areas.map((area) => (
              <option key={area.id} value={area.id}>
                {area.name}
              </option>
            ))}
          </optgroup>
        ),
      )}
    </SelectField>
  );
});

/** The LGAs a provider covers. Search by an LGA finds providers serving it. */
export function AreaChecklist({
  value,
  onChange,
  legend,
  hint,
  error,
}: {
  value: number[];
  onChange: (ids: number[]) => void;
  legend: string;
  hint?: string;
  error?: string;
}) {
  const { data } = useTaxonomy();
  const lgas = (data?.locations ?? []).filter((l) => l.type === 'lga').sort((a, b) => a.name.localeCompare(b.name));

  return (
    <FieldGroup legend={legend} hint={hint} error={error}>
      <div className="grid gap-x-4 sm:grid-cols-2 lg:grid-cols-3">
        {lgas.map((lga) => (
          <CheckboxField
            key={lga.id}
            label={lga.name}
            checked={value.includes(lga.id)}
            onChange={(e) => onChange(e.target.checked ? [...value, lga.id] : value.filter((id) => id !== lga.id))}
          />
        ))}
      </div>
    </FieldGroup>
  );
}
