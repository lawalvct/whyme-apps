import type { Metadata } from 'next';
import { EmployerCentreView } from '@/components/jobs/EmployerCentreView';
import { SignedInOnly } from '@/components/seller/SellerShell';

export const metadata: Metadata = { title: 'Employer centre' };

export default function EmployerCentrePage() {
  return (
    <SignedInOnly>
      <EmployerCentreView />
    </SignedInOnly>
  );
}
