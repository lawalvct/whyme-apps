import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: { default: 'Checkout', template: '%s | WHY ME' },
  robots: { index: false, follow: false },
};

/** Private to the signed-in buyer: rendered in the browser, never cached on the server. */
export default function CheckoutLayout({ children }: { children: ReactNode }) {
  return children;
}
