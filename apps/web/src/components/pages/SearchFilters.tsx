'use client';

import { useId, useState, type FormEvent } from 'react';
import { categoryLabel, type Taxonomy } from '@whyme/data';
import { MarketplaceIcon as Icon, type MarketplaceIconName } from '@/components/ui/MarketplaceIcon';
import { useLanguage, useT } from '@/lib/i18n';
import styles from './SearchView.module.css';

export type SearchFilterPatch = {
  q?: string | null;
  kind?: string | null;
  category_id?: number | null;
  location_id?: number | null;
  min_price?: number | null;
  max_price?: number | null;
};

type Props = {
  type: 'offers' | 'people';
  kind: string | null;
  q: string;
  categoryId: number | null;
  locationId: number | null;
  minPrice: number | null;
  maxPrice: number | null;
  taxonomy: Taxonomy | undefined;
  taxonomyError: boolean;
  retryTaxonomy: () => void;
  onChange: (patch: SearchFilterPatch) => void;
};

const kindOptions: Record<string, { label: string; icon: MarketplaceIconName }> = {
  product: { label: 'products', icon: 'bag' },
  service: { label: 'services', icon: 'tools' },
  business: { label: 'businesses', icon: 'shop' },
  provider: { label: 'providers', icon: 'user' },
};

const pricePresets = [
  { min: null, max: 10000, label: 'searchBudgetLow' },
  { min: 10000, max: 50000, label: 'searchBudgetMid' },
  { min: 50000, max: null, label: 'searchBudgetHigh' },
] as const;

export function SearchFilters({ type, kind, q, categoryId, locationId, minPrice, maxPrice, taxonomy, taxonomyError, retryTaxonomy, onChange }: Props) {
  const { t } = useT('market');
  const language = useLanguage();
  const id = useId();
  const [categoryQuery, setCategoryQuery] = useState('');
  const [expanded, setExpanded] = useState(false);
  const kinds = type === 'offers' ? ['product', 'service'] : ['business', 'provider'];
  const categoryTypes = kind === 'product' || kind === 'business' ? ['product'] : kind ? ['service'] : ['product', 'service'];
  const categories = (taxonomy?.categories ?? []).filter((category) => categoryTypes.includes(category.type))
    .sort((a, b) => Number(b.type === 'product') - Number(a.type === 'product'));
  const matching = categories.filter((category) => (categoryLabel(category, language) ?? '').toLocaleLowerCase().includes(categoryQuery.trim().toLocaleLowerCase()));
  const selected = matching.find((category) => category.id === categoryId);
  const preview = matching.slice(0, 6);
  if (selected && !preview.some((category) => category.id === selected.id)) preview[preview.length - 1] = selected;
  const visible = expanded || categoryQuery ? matching : preview;
  const areas = (taxonomy?.locations ?? []).filter((location) => location.type !== 'state');

  return (
    <div className={styles.filterFields}>
      <form key={q} className={styles.keywordForm} onSubmit={(event) => {
        event.preventDefault();
        const value = String(new FormData(event.currentTarget).get('keyword') ?? '').trim();
        onChange({ q: value || null });
      }}>
        <label htmlFor={`${id}-keyword`} className={styles.filterLabel}>{t('searchKeyword')}</label>
        <div className={styles.keywordInput}><input id={`${id}-keyword`} name="keyword" type="search" defaultValue={q} placeholder={t('searchKeywordPlaceholder')} minLength={2} maxLength={100} /><button type="submit" aria-label={t('search')}><Icon name="search" /></button></div>
      </form>

      <fieldset className={styles.filterGroup}>
        <legend>{t('searchLookingFor')}</legend>
        <div className={styles.radioList}>
          {[null, ...kinds].map((value) => {
            const option = value ? kindOptions[value] : { label: type === 'offers' ? 'searchAllOffers' : 'searchAllPeople', icon: 'grid' as const };
            return <label key={value ?? 'all'} className={styles.kindOption}><input type="radio" name={`${id}-kind`} checked={kind === value} onChange={() => { onChange({ kind: value, category_id: null }); setCategoryQuery(''); setExpanded(false); }} /><Icon name={option.icon} /><span>{t(option.label)}</span></label>;
          })}
        </div>
      </fieldset>

      <fieldset className={styles.filterGroup}>
        <legend>{t('category')}</legend>
        {categories.length > 6 && <div className={styles.categorySearch}><Icon name="search" /><input type="search" value={categoryQuery} onChange={(event) => setCategoryQuery(event.target.value)} placeholder={t('searchCategories')} aria-label={t('searchCategories')} /></div>}
        {!taxonomy ? <div><p className={styles.filterHint} role="status">{t(taxonomyError ? 'searchFiltersUnavailable' : 'common:loading')}</p>{taxonomyError && <button type="button" className={styles.expandCategories} onClick={retryTaxonomy}>{t('common:retry')}</button>}</div> : <div className={styles.radioList}>
          <label className={styles.categoryOption}><input type="radio" name={`${id}-category`} checked={categoryId === null} onChange={() => onChange({ category_id: null })} /><span>{t('allCategories')}</span></label>
          {visible.map((category) => <label key={category.id} className={styles.categoryOption}><input type="radio" name={`${id}-category`} checked={categoryId === category.id} onChange={() => onChange({ category_id: category.id })} /><span>{categoryLabel(category, language)}</span></label>)}
          {matching.length === 0 && <p className={styles.filterHint}>{t('searchNoCategories')}</p>}
        </div>}
        {!categoryQuery && categories.length > 6 && <button type="button" className={styles.expandCategories} aria-expanded={expanded} onClick={() => setExpanded(!expanded)}>{t(expanded ? 'homeShowFewerCategories' : 'searchAllCategories', { count: categories.length })}<Icon name="chevron" style={{ transform: expanded ? 'rotate(180deg)' : undefined }} /></button>}
      </fieldset>

      <fieldset className={styles.filterGroup}>
        <legend>{t('location')}</legend>
        <p id={`${id}-location-hint`} className={styles.filterHint}>{t('searchLocationHint')}</p>
        <div className={styles.locationInput}><Icon name="pin" /><select id={`${id}-location`} disabled={!taxonomy} aria-label={t('location')} aria-describedby={`${id}-location-hint`} value={locationId ?? ''} onChange={(event) => onChange({ location_id: event.target.value ? Number(event.target.value) : null })}><option value="">{t('allAreas')}</option>{areas.map((location) => <option key={location.id} value={location.id}>{location.name}</option>)}</select></div>
      </fieldset>

      {type === 'offers' && <PriceFilter key={`${minPrice}-${maxPrice}`} id={id} minPrice={minPrice} maxPrice={maxPrice} onChange={onChange} />}
    </div>
  );
}

function PriceFilter({ id, minPrice, maxPrice, onChange }: Pick<Props, 'minPrice' | 'maxPrice' | 'onChange'> & { id: string }) {
  const { t } = useT('market');
  const [minimum, setMinimum] = useState(minPrice?.toString() ?? '');
  const [maximum, setMaximum] = useState(maxPrice?.toString() ?? '');
  const [error, setError] = useState(false);
  function apply(event: FormEvent) {
    event.preventDefault();
    const min = minimum === '' ? null : Number(minimum);
    const max = maximum === '' ? null : Number(maximum);
    if ((min !== null && (!Number.isSafeInteger(min) || min < 0)) || (max !== null && (!Number.isSafeInteger(max) || max < 0)) || (min !== null && max !== null && min > max)) {
      setError(true);
      return;
    }
    setError(false);
    onChange({ min_price: min, max_price: max });
  }
  return <fieldset className={styles.filterGroup}><legend>{t('searchPriceRange')}</legend><p className={styles.filterHint}>{t('searchPriceHint')}</p><form onSubmit={apply}>
    <div className={styles.priceInputs}>
      <label htmlFor={`${id}-min`}><span>{t('searchMinimum')}</span><div><span aria-hidden="true">₦</span><input id={`${id}-min`} type="number" inputMode="numeric" min="0" max="1000000000000" step="1" placeholder="0" value={minimum} onChange={(event) => { setMinimum(event.target.value); setError(false); }} aria-describedby={error ? `${id}-price-error` : undefined} aria-invalid={error} /></div></label>
      <label htmlFor={`${id}-max`}><span>{t('searchMaximum')}</span><div><span aria-hidden="true">₦</span><input id={`${id}-max`} type="number" inputMode="numeric" min="0" max="1000000000000" step="1" placeholder={t('searchAnyPrice')} value={maximum} onChange={(event) => { setMaximum(event.target.value); setError(false); }} aria-describedby={error ? `${id}-price-error` : undefined} aria-invalid={error} /></div></label>
    </div>
    {error && <p id={`${id}-price-error`} role="alert" className={styles.priceError}>{t('searchInvalidPrice')}</p>}
    <button type="submit" className={styles.applyPrice}>{t('searchApplyPrice')}<Icon name="arrow" /></button>
  </form><div className={styles.pricePresets}>
    {pricePresets.map(({ min, max, label }) => <button key={label} type="button" aria-pressed={minPrice === min && maxPrice === max} onClick={() => onChange({ min_price: min, max_price: max })}>{t(label)}</button>)}
  </div></fieldset>;
}
