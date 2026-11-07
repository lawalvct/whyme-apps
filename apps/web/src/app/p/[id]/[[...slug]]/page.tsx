import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { DetailSkeleton } from '@/components/pages/DetailSkeleton';
import { ProfileView } from '@/components/pages/ProfileView';
import { routes } from '@/lib/format';
import { getProfile, getProfileListings } from '@/lib/server-api';

type Props = PageProps<'/p/[id]/[[...slug]]'>;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const profile = await getProfile(id);
  if (!profile) return { title: 'Not found', robots: { index: false } };

  const image = profile.logo?.large ?? profile.photos[0]?.urls.large;
  return {
    title: `${profile.display_name} – ${profile.category.name ?? ''} in ${profile.location.name ?? 'Delta'}`,
    description: profile.about?.slice(0, 155) ?? undefined,
    alternates: { canonical: routes.profile(profile) },
    openGraph: { title: profile.display_name, images: image ? [{ url: image }] : undefined },
  };
}

/** A business or provider page with what they offer. */
export default function ProfilePage({ params }: Props) {
  return (
    <Suspense fallback={<DetailSkeleton />}>
      <ProfileDetails params={params} />
    </Suspense>
  );
}

async function ProfileDetails({ params }: Pick<Props, 'params'>) {
  const { id } = await params;
  const [profile, listings] = await Promise.all([getProfile(id), getProfileListings(id)]);
  if (!profile) notFound();
  return <ProfileView profile={profile} listings={listings} />;
}
