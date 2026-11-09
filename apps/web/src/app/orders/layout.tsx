import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: { default: 'Orders', template: '%s | Orders | WHY ME' },
  robots: { index: false, follow: false },
};

/** Private to the signed-in user: rendered in the browser, never cached on the server. */
export default function OrdersLayout({ children }: { children: ReactNode }) {
  return children;
}
