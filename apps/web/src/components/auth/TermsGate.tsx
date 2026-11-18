'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiRequestError, queryKeys, unwrap, useApi } from '@whyme/data';
import { TermsDocument } from '@/components/legal/TermsDocument';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useLanguage, useT } from '@/lib/i18n';
import { useAccount } from '@/lib/session';

/**
 * Asks a signed-in person to accept the Platform Terms when a new version is published, or when
 * the account never accepted (made before sign-up recorded it). Shows the terms in full; "I agree"
 * records the version they were shown, and the server refuses if a newer one appeared meanwhile.
 * "Not now" hides it until the next visit: buying and selling have their own acceptance steps.
 */
export function TermsGate() {
  const { user } = useAccount();
  // Not over the terms pages themselves: the person is already reading them.
  const onTermsPage = usePathname().startsWith('/terms');
  const pending = Boolean(user?.pending_terms?.includes('platform')) && !onTermsPage;
  const [dismissed, setDismissed] = useState(() => {
    try {
      return window.sessionStorage.getItem('whyme.termsLater') === '1';
    } catch {
      return false;
    }
  });
  if (!pending || dismissed) return null;
  return (
    <TermsDialog
      onLater={() => {
        try {
          window.sessionStorage.setItem('whyme.termsLater', '1');
        } catch {
          // Private browsing: it just comes back next page.
        }
        setDismissed(true);
      }}
    />
  );
}

function TermsDialog({ onLater }: { onLater: () => void }) {
  const { t } = useT('auth');
  const language = useLanguage();
  const api = useApi();
  const queryClient = useQueryClient();
  const dialog = useRef<HTMLDialogElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const terms = useQuery({
    queryKey: ['terms', 'platform', language],
    queryFn: async () => unwrap(await api.GET('/v1/terms/{type}', { params: { path: { type: 'platform' } } })).data,
  });

  useEffect(() => {
    const el = dialog.current;
    if (el && !el.open) el.showModal();
  }, []);

  async function agree() {
    if (busy || !terms.data) return;
    setBusy(true);
    setError(null);
    try {
      await api.POST('/v1/me/terms/accept', { body: { type: 'platform', version: terms.data.version } }).then((r) => unwrap(r));
      await queryClient.invalidateQueries({ queryKey: queryKeys.me });
    } catch (e) {
      if (e instanceof ApiRequestError && e.code === 'terms_changed') {
        setError(t('termsChanged'));
        await terms.refetch();
      } else {
        setError(t('termsSaveFailed'));
      }
      setBusy(false);
    }
  }

  return (
    <dialog
      ref={dialog}
      aria-labelledby="terms-update-title"
      onCancel={(event) => {
        event.preventDefault();
        onLater();
      }}
      className="m-auto w-[min(42rem,calc(100%-2rem))] rounded-2xl border border-border bg-background p-0 text-text backdrop:bg-black/50"
    >
      <div className="flex max-h-[85vh] flex-col gap-3 p-5">
        <h2 id="terms-update-title" className="text-xl font-bold">
          {t('termsUpdatedTitle')}
        </h2>
        <p className="text-sm text-text-muted">{t('termsUpdatedBody')}</p>
        {terms.isPending ? (
          <Skeleton className="h-48 w-full" />
        ) : terms.isError ? (
          <p role="alert" className="text-sm text-danger">
            {t('termsSaveFailed')}
          </p>
        ) : (
          <div className="min-h-0 flex-1 overflow-y-auto rounded-lg border border-border p-3" lang={terms.data.locale} tabIndex={0}>
            <TermsDocument body={terms.data.body} contents={false} />
          </div>
        )}
        {error ? (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        ) : null}
        <div className="flex flex-wrap gap-2">
          <Button disabled={busy || !terms.data} onClick={() => void agree()}>
            {busy ? t('common:loading') : t('termsAgree')}
          </Button>
          <Button variant="ghost" disabled={busy} onClick={onLater}>
            {t('termsLater')}
          </Button>
        </div>
      </div>
    </dialog>
  );
}
