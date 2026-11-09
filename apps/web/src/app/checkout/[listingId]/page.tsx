import { Suspense } from 'react';
import { RequireAccount } from '@/components/auth/RequireAccount';
import { CheckoutView } from '@/components/orders/CheckoutView';
import { Skeleton } from '@/components/ui/skeleton';

type Props = PageProps<'/checkout/[listingId]'>;

export default function CheckoutPage({ params }: Props) {
  return (
    <Suspense fallback={<Skeleton className="h-96 w-full" />}>
      <Checkout params={params} />
    </Suspense>
  );
}

async function Checkout({ params }: Pick<Props, 'params'>) {
  const { listingId } = await params;
  return (
    <RequireAccount phone="buy">
      <CheckoutView listingId={listingId} />
    </RequireAccount>
  );
}
