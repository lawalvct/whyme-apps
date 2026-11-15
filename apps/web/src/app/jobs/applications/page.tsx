import type { Metadata } from 'next';
import { SignedInOnly } from '@/components/seller/SellerShell';
import { ApplicationsListView } from '@/components/jobs/ApplicationsListView';

export const metadata: Metadata = {
  title: 'Job Applications — WHY ME',
  robots: { index: false, follow: false },
};

export default function ApplicationsPage() {
  return (
    <SignedInOnly>
      <ApplicationsListView />
    </SignedInOnly>
  );
}
