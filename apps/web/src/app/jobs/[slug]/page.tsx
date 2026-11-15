import type { Metadata } from 'next';
import { Suspense } from 'react';
import { JobDetailView } from '@/components/jobs/JobDetailView';
import { Skeleton } from '@/components/ui/skeleton';

export const metadata: Metadata = { title: 'Job vacancy' };

export default function JobDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  return (
    <Suspense fallback={<div className="mx-auto max-w-4xl px-4 py-8"><Skeleton className="h-64 w-full" /></div>}>
      <JobDetail params={params} />
    </Suspense>
  );
}

async function JobDetail({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <JobDetailView slugOrId={slug} />;
}
