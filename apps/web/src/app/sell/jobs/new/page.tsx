import type { Metadata } from 'next';
import { VacancyEditor } from '@/components/jobs/VacancyEditor';
import { SignedInOnly } from '@/components/seller/SellerShell';

export const metadata: Metadata = { title: 'New vacancy' };

export default function NewVacancyPage() {
  return (
    <SignedInOnly>
      <VacancyEditor />
    </SignedInOnly>
  );
}
