import { SellerHome } from '@/components/seller/SellerHome';
import { SignedInOnly } from '@/components/seller/SellerShell';

export default function SellPage() {
  return (
    <SignedInOnly>
      <SellerHome />
    </SignedInOnly>
  );
}
