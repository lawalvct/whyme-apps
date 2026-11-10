import type { Metadata } from 'next';
import { notFound, permanentRedirect } from 'next/navigation';
import { ProfileView } from '@/components/pages/ProfileView';
import { routes } from '@/lib/format';
import { getProfile, getProfileListings } from '@/lib/server-api';
import { absoluteUrl, jsonLdHtml, profileJsonLd } from '@/lib/seo';

type Props = PageProps<'/p/[slug]/[[...rest]]'>;

/**
 * Waits for the page before sending anything, so an old address (an ID link, a slug from
 * before a rename, or the old /p/{id}/{name} form) gets a real 308 redirect and a missing
 * page a real 404.
 */
export const instant = false;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const profile = await getProfile(slug);
  if (!profile) return { title: 'Not found', robots: { index: false } };

  const image = profile.logo?.large ?? profile.photos[0]?.urls.large;
  const title = `${profile.display_name} – ${profile.category.name ?? ''} in ${profile.location.name ?? 'Delta'}`;
  const description = profile.about?.replace(/\s+/g, ' ').slice(0, 155) ?? undefined;
  const url = routes.profile(profile);

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: { type: 'website', url: absoluteUrl(url), title: profile.display_name, description, images: image ? [{ url: image, alt: profile.display_name }] : undefined },
    twitter: { card: image ? 'summary_large_image' : 'summary', title: profile.display_name, description, images: image ? [image] : undefined },
  };
}

/** A business or provider page at /p/{slug}, with what they offer. */
export default async function ProfilePage({ params }: Props) {
  const { slug, rest } = await params;
  const profile = await getProfile(slug);
  if (!profile) notFound();
  if ((rest?.length ?? 0) > 0 || profile.slug !== slug) permanentRedirect(routes.profile(profile));

  const listings = await getProfileListings(profile.slug);
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdHtml(profileJsonLd(profile)) }} />
      <ProfileView profile={profile} listings={listings} />
    </>
  );
}
