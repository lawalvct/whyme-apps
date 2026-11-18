import type { Metadata } from 'next';
import Link from 'next/link';
import { TermsDocument } from '@/components/legal/TermsDocument';
import { routes } from '@/lib/format';
import { getTerms } from '@/lib/server-api';

export const metadata: Metadata = { title: 'WHY ME Privacy Policy', alternates: { canonical: routes.privacy } };

/** How WHY ME handles personal data (NDPA 2023). Public, server-rendered like the terms. */
export default async function PrivacyPage() {
  const policy = await getTerms('privacy');

  return (
    <article className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-1 py-8 sm:py-10">
      <h1 className="text-3xl font-bold">{policy?.title ?? 'WHY ME Privacy Policy'}</h1>
      {policy ? (
        <>
          <p className="text-sm text-text-muted">
            Version {policy.version}
            {policy.published_at ? ` · ${new Intl.DateTimeFormat('en-NG', { dateStyle: 'long', timeZone: 'Africa/Lagos' }).format(new Date(policy.published_at))}` : ''}
          </p>
          <TermsDocument body={policy.body} />
        </>
      ) : (
        <p className="text-text-muted">This policy is not published yet.</p>
      )}
      <nav aria-label="Terms" className="flex flex-wrap gap-4 border-t border-border pt-4 text-sm font-semibold text-primary">
        <Link href={routes.terms('platform')} className="hover:underline">Platform Terms</Link>
        <Link href={routes.terms('buyer')} className="hover:underline">Buyer Terms</Link>
        <Link href={routes.terms('seller')} className="hover:underline">Seller Terms</Link>
      </nav>
    </article>
  );
}
