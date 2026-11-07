'use client';

import { useState, type FormEvent } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { queryKeys, unwrap, useApi, useTerms } from '@whyme/data';
import { Button } from '@/components/ui/button';
import { CheckboxField, FieldGroup } from '@/components/ui/field';
import { Skeleton } from '@/components/ui/skeleton';
import { useLanguage, useT } from '@/lib/i18n';
import { Card, Notice, useErrorText } from './common';

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
    <Card className={compact ? undefined : 'mx-auto w-full max-w-2xl'}>
      <form method="post" onSubmit={(e) => void onSubmit(e)} noValidate className="flex flex-col gap-5">
        <div>
          <h2 className="text-xl font-bold">{compact ? t('addCapabilityTitle') : t('startTitle')}</h2>
          {compact ? null : <p className="mt-1 text-text-muted">{t('startIntro')}</p>}
        </div>

        {only ? (
          <p className="text-sm text-text-muted">
            <span className="font-semibold text-text">{options.find((o) => o.value === only)?.label}.</span>{' '}
            {options.find((o) => o.value === only)?.hint}
          </p>
        ) : (
          <FieldGroup legend={t('chooseOne')} className="gap-3">
            {options.map((option) => (
              <label
                key={option.value}
                className="flex cursor-pointer gap-3 rounded-xl border border-border p-4 has-checked:border-primary has-checked:bg-primary-soft"
              >
                <input
                  type="checkbox"
                  className="mt-1 size-5 shrink-0 accent-primary"
                  checked={chosen.includes(option.value)}
                  onChange={(e) =>
                    setChosen((list) => (e.target.checked ? [...list, option.value] : list.filter((v) => v !== option.value)))
                  }
                />
                <span>
                  <span className="block font-semibold">{option.label}</span>
                  <span className="block text-sm text-text-muted">{option.hint}</span>
                </span>
              </label>
            ))}
          </FieldGroup>
        )}

        <div className="flex flex-col gap-2">
          <h3 className="text-sm font-semibold">{t('termsHeading')}</h3>
          {terms.isPending ? (
            <Skeleton className="h-32 w-full" />
          ) : terms.data ? (
            <div className="max-h-56 overflow-y-auto rounded-lg border border-border bg-surface p-4 text-sm leading-relaxed">
              <p className="font-semibold">{terms.data.title}</p>
              <p className="mb-2 text-xs text-text-muted">{t('termsVersion', { version: terms.data.version })}</p>
              <div className="whitespace-pre-line" lang={terms.data.locale}>
                {terms.data.body}
              </div>
            </div>
          ) : (
            <Notice tone="error">{t('termsUnavailable')}</Notice>
          )}
          <CheckboxField label={t('acceptTerms')} checked={accepted} onChange={(e) => setAccepted(e.target.checked)} />
        </div>

        {problem ? <Notice tone="error">{problem}</Notice> : null}

        <Button type="submit" disabled={busy || !terms.data} className="self-start">
          {busy ? t('common:loading') : only === 'vendor' ? t('alsoProducts') : only === 'provider' ? t('alsoServices') : t('activate')}
        </Button>
      </form>
    </Card>
  );
}
