import type { Metadata } from 'next';
import { Suspense } from 'react';
import { RequireAccount } from '@/components/auth/RequireAccount';
import { ApplicationDetailView } from '@/components/jobs/ApplicationDetailView';
import { Skeleton } from '@/components/ui/skeleton';

export const metadata: Metadata = {
  title: 'Application Details — WHY ME',
  robots: { index: false, follow: false },
};

type Props = PageProps<'/jobs/applications/[id]'>;

/** The id is only known at request time, so it is read inside Suspense (as on the order and request pages). */
export default function ApplicationDetailPage({ params }: Props) {
  return (
    <Suspense fallback={<Skeleton className="h-96 w-full" />}>
      <ApplicationDetail params={params} />
    </Suspense>
  );
}

async function ApplicationDetail({ params }: Pick<Props, 'params'>) {
  const { id } = await params;
  return (
    <RequireAccount phone="jobs">
      <ApplicationDetailView applicationId={id} />
    </RequireAccount>
  );
}
