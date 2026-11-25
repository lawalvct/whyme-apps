import type { Metadata } from 'next';
import { RequireAccount } from '@/components/auth/RequireAccount';
import { ApplicationsListView } from '@/components/jobs/ApplicationsListView';

export const metadata: Metadata = {
  title: 'Job Applications — WHY ME',
  robots: { index: false, follow: false },
};

export default function ApplicationsPage() {
  return (
    <RequireAccount phone="jobs">
      <ApplicationsListView />
    </RequireAccount>
  );
}
