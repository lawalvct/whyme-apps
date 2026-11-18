import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { TermsDocument } from '@/components/legal/TermsDocument';
import { routes } from '@/lib/format';
import { getTerms } from '@/lib/server-api';

type Props = PageProps<'/terms/[type]'>;

const TYPES = ['platform', 'seller', 'buyer'] as const;
type TermsType = (typeof TYPES)[number];
const NAMES: Record<TermsType, string> = { platform: 'Platform Terms', buyer: 'Buyer Terms', seller: 'Seller Terms' };

/** A bad address is a real 404, not a page that loads and then says "not found". */
export const instant = false;

export function generateStaticParams() {
  return TYPES.map((type) => ({ type }));
}

function isType(value: string): value is TermsType {
  return (TYPES as readonly string[]).includes(value);
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { type } = await params;
  if (!isType(type)) return { title: 'Not found', robots: { index: false } };
  return { title: `WHY ME ${NAMES[type]}`, alternates: { canonical: routes.terms(type) } };
}

/** The published terms, readable without an account (ACC07, SAF09). Text is plain, with numbered sections. */
export default async function TermsPage({ params }: Props) {
  const { type } = await params;
  if (!isType(type)) notFound();
  const terms = await getTerms(type);

  return (
    <article className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-1 py-8 sm:py-10">
      <h1 className="text-3xl font-bold">{terms?.title ?? `WHY ME ${NAMES[type]}`}</h1>
      {terms ? (
        <>
          <p className="text-sm text-text-muted">
            Version {terms.version}
            {terms.published_at ? ` · ${new Intl.DateTimeFormat('en-NG', { dateStyle: 'long', timeZone: 'Africa/Lagos' }).format(new Date(terms.published_at))}` : ''}
          </p>
          <TermsDocument body={terms.body} />
        </>
      ) : (
        <p className="text-text-muted">These terms are not published yet.</p>
      )}
      <nav aria-label="Other terms" className="flex flex-wrap gap-4 border-t border-border pt-4 text-sm font-semibold text-primary">
        {TYPES.filter((other) => other !== type).map((other) => (
          <Link key={other} href={routes.terms(other)} className="hover:underline">
            {NAMES[other]}
          </Link>
        ))}
        <Link href={routes.privacy} className="hover:underline">
          Privacy Policy
        </Link>
      </nav>
    </article>
  );
}
