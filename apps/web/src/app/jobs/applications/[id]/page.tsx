import type { Metadata } from 'next';
import { SignedInOnly } from '@/components/seller/SellerShell';
import { ApplicationDetailView } from '@/components/jobs/ApplicationDetailView';

export const metadata: Metadata = {
  title: 'Application Details — WHY ME',
  robots: { index: false, follow: false },
};

export default async function ApplicationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <SignedInOnly>
      <ApplicationDetailView applicationId={id} />
    </SignedInOnly>
  );
}
