import type { Metadata } from 'next';
import { RequireAccount } from '@/components/auth/RequireAccount';
import { SeekerProfileView } from '@/components/jobs/SeekerProfileView';

export const metadata: Metadata = {
  title: 'My CV & Seeker Profile — WHY ME',
  robots: { index: false, follow: false },
};

export default function SeekerProfilePage() {
  return (
    <RequireAccount phone="jobs">
      <SeekerProfileView />
    </RequireAccount>
  );
}
