import type { Metadata } from 'next';
import { Suspense } from 'react';
import { RequireAccount } from '@/components/auth/RequireAccount';
import { OrderView } from '@/components/orders/OrderView';
import { Skeleton } from '@/components/ui/skeleton';

export const metadata: Metadata = { title: 'Order' };

type Props = PageProps<'/orders/[id]'>;

export default function OrderPage({ params }: Props) {
  return (
    <Suspense fallback={<Skeleton className="h-96 w-full" />}>
      <Order params={params} />
    </Suspense>
  );
}

async function Order({ params }: Pick<Props, 'params'>) {
  const { id } = await params;
  return (
    <RequireAccount phone="buy">
      <OrderView id={id} />
    </RequireAccount>
  );
}
