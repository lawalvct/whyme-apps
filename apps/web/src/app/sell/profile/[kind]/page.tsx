import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { ProfileEditor } from '@/components/seller/ProfileEditor';
import { SignedInOnly } from '@/components/seller/SellerShell';
import { Skeleton } from '@/components/ui/skeleton';

export const metadata: Metadata = { title: 'Your page' };

type Props = PageProps<'/sell/profile/[kind]'>;

export default function EditProfilePage({ params }: Props) {
  return (
    <Suspense fallback={<Skeleton className="h-96 w-full" />}>
      <EditProfile params={params} />
    </Suspense>
  );
}

async function EditProfile({ params }: Pick<Props, 'params'>) {
  const { kind } = await params;
  if (kind !== 'business' && kind !== 'provider') notFound();
  return (
    <SignedInOnly>
      <ProfileEditor kind={kind} />
    </SignedInOnly>
  );
}
