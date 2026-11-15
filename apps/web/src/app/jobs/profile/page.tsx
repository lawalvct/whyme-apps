import type { Metadata } from 'next';
import { SignedInOnly } from '@/components/seller/SellerShell';
import { SeekerProfileView } from '@/components/jobs/SeekerProfileView';

export const metadata: Metadata = {
  title: 'My CV & Seeker Profile — WHY ME',
  robots: { index: false, follow: false },
};

export default function SeekerProfilePage() {
  return (
    <SignedInOnly>
      <SeekerProfileView />
    </SignedInOnly>
  );
}
