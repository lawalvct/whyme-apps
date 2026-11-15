import type { Metadata } from 'next';
import { Suspense } from 'react';
import { VacancyEditor } from '@/components/jobs/VacancyEditor';
import { SignedInOnly } from '@/components/seller/SellerShell';
import { Skeleton } from '@/components/ui/skeleton';

export const metadata: Metadata = { title: 'Edit vacancy' };

export default function EditVacancyPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<Skeleton className="h-96 w-full" />}>
      <EditVacancy params={params} />
    </Suspense>
  );
}

async function EditVacancy({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <SignedInOnly>
      <VacancyEditor vacancyId={id} />
    </SignedInOnly>
  );
}
