import type { Metadata } from 'next';
import { Suspense } from 'react';
import { RequireAccount } from '@/components/auth/RequireAccount';
import { RequestView } from '@/components/requests/RequestView';
import { Skeleton } from '@/components/ui/skeleton';

export const metadata: Metadata = { title: 'Service request' };

type Props = { params: Promise<{ id: string }> };

export default function RequestPage({ params }: Props) {
  return (
    <Suspense fallback={<Skeleton className="h-96 w-full" />}>
      <Request params={params} />
    </Suspense>
  );
}

async function Request({ params }: Pick<Props, 'params'>) {
  const { id } = await params;
  return (
    <RequireAccount phone="buy">
      <RequestView id={id} />
    </RequireAccount>
  );
}
