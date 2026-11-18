import type { Metadata } from 'next';
import { Suspense } from 'react';
import { RequireAccount } from '@/components/auth/RequireAccount';
import { BusinessCenter } from '@/components/seller/BusinessCenter';
import { Skeleton } from '@/components/ui/skeleton';

export const metadata: Metadata = { title: 'Plans & promotion' };

/** Paystack sends buyers back here with `?purchase=` (PayForBillingPurchase's callback URL). */
export default function SellerBillingPage() {
  return (
    <Suspense fallback={<Skeleton className="h-96 w-full" />}>
      <RequireAccount phone="seller">
        <BusinessCenter />
      </RequireAccount>
    </Suspense>
  );
}
