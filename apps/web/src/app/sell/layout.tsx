import type { Metadata } from 'next';
import { Suspense } from 'react';
import { SellerShell } from '@/components/seller/SellerShell';
import { Skeleton } from '@/components/ui/skeleton';

export const metadata: Metadata = {
  title: { default: 'Seller centre', template: '%s | Seller centre | WHY ME' },
  robots: { index: false, follow: false },
};

/** The seller centre runs in the browser: it's private to the signed-in seller and never cached on the server. */
export default function SellLayout({ children }: LayoutProps<'/sell'>) {
  return (
    <Suspense fallback={<Skeleton className="h-96 w-full" />}>
      <SellerShell>{children}</SellerShell>
    </Suspense>
  );
}
