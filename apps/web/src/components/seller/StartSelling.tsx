'use client';

import { useState, type FormEvent } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { queryKeys, unwrap, useApi, useTerms } from '@whyme/data';
import { Button } from '@/components/ui/button';
import { CheckboxField, FieldGroup } from '@/components/ui/field';
import { Skeleton } from '@/components/ui/skeleton';
import { MarketplaceIcon as Icon } from '@/components/ui/MarketplaceIcon';
import { useLanguage, useT } from '@/lib/i18n';
import { Notice, useErrorText } from './common';
import styles from './SellerCentre.module.css';

type SellerCapability = 'vendor' | 'provider';

/**
 * Turns selling on for this account (ACC07): pick products and/or services,
 * read and accept the current seller terms, and the API records which version
 * was accepted and in which language (AT62, I18N06).
 */
export function StartSelling({ only, compact = false }: { only?: SellerCapability; compact?: boolean }) {
  const { t } = useT('seller');
  const language = useLanguage();
  const api = useApi();
  const queryClient = useQueryClient();
  const errorText = useErrorText();
  const terms = useTerms('seller', language);

  const [chosen, setChosen] = useState<SellerCapability[]>(only ? [only] : []);
  const [accepted, setAccepted] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const options: { value: SellerCapability; label: string; hint: string }[] = [
    { value: 'vendor', label: t('sellProducts'), hint: t('sellProductsHint') },
    { value: 'provider', label: t('offerServices'), hint: t('offerServicesHint') },
  ];

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setProblem(null);
    if (chosen.length === 0) return setProblem(t('chooseOne'));
    if (!accepted) return setProblem(t('acceptTermsRequired'));
    if (!terms.data) return setProblem(t('termsUnavailable'));

    setBusy(true);
    try {
      for (const capability of chosen) {
        unwrap(await api.POST('/v1/me/capabilities', { body: { capability, terms_version_id: terms.data.id } }));
      }
      await queryClient.invalidateQueries({ queryKey: queryKeys.me });
    } catch (e) {
      setProblem(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className={`${styles.onboarding} ${compact ? styles.compactOnboarding : ''}`}>
      <header className={styles.onboardingHeader}><div><span className={styles.eyebrow}>{t('overview.madeForLocal')}</span>{compact ? <h2>{t('addCapabilityTitle')}</h2> : <h1>{t('startTitle')}</h1>}<p>{t(compact ? 'overview.addCapabilityHint' : 'startIntro')}</p></div><span><Icon name={only === 'provider' ? 'tools' : 'shop'} /></span></header>
      <form method="post" onSubmit={(e) => void onSubmit(e)} noValidate className={styles.activationForm} aria-busy={busy}>

        {only ? (
          <p className={styles.onlyCapability}>
            <Icon name={only === 'vendor' ? 'bag' : 'tools'} />
            <span>
              <span className="font-semibold text-text">{options.find((o) => o.value === only)?.label}.</span>{' '}
              {options.find((o) => o.value === only)?.hint}
            </span>
          </p>
        ) : (
          <FieldGroup legend={t('overview.whatToOffer')} hint={t('overview.chooseBoth')} className={styles.capabilityGroup}>
            {options.map((option) => (
              <label
                key={option.value}
                className={styles.capabilityOption}
              >
                <input
                  type="checkbox"
                  className="mt-1 size-5 shrink-0 accent-primary"
                  disabled={busy}
                  checked={chosen.includes(option.value)}
                  onChange={(e) =>
                    setChosen((list) => (e.target.checked ? [...list, option.value] : list.filter((v) => v !== option.value)))
                  }
                />
                <span className={styles.capabilityIcon}><Icon name={option.value === 'vendor' ? 'bag' : 'tools'} /></span>
                <span className={styles.capabilityCopy}>
                  <strong>{option.label}</strong>
                  <span>{option.hint}</span>
                </span>
              </label>
            ))}
          </FieldGroup>
        )}

        <div className={styles.termsSection}>
          <h3><Icon name="shield" />{t('termsHeading')}</h3>
          {terms.isPending ? (
            <Skeleton className="h-32 w-full" />
          ) : terms.data ? (
            <div className={styles.termsBody} tabIndex={0} role="region" aria-label={t('termsHeading')}>
              <p className="font-semibold">{terms.data.title}</p>
              <p className="mb-2 text-xs text-text-muted">{t('termsVersion', { version: terms.data.version })}</p>
              <div className="whitespace-pre-line" lang={terms.data.locale}>
                {terms.data.body}
              </div>
            </div>
          ) : (
            <Notice tone="error">{t('termsUnavailable')}</Notice>
          )}
          <CheckboxField label={t('acceptTerms')} className={styles.acceptTerms} checked={accepted} disabled={busy || !terms.data} onChange={(e) => setAccepted(e.target.checked)} />
        </div>

        {problem ? <Notice tone="error">{problem}</Notice> : null}

        <Button type="submit" disabled={busy || !terms.data} className={styles.activateButton}>
          {busy ? t('common:loading') : only === 'vendor' ? t('alsoProducts') : only === 'provider' ? t('alsoServices') : t('activate')}
          <Icon name="arrow" />
        </Button>
      </form>
    </section>
  );
}
