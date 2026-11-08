import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: { default: 'Messages', template: '%s | Messages | WHY ME' },
  robots: { index: false, follow: false },
};

/** Private to the signed-in user: rendered in the browser, never cached on the server. */
export default function MessagesLayout({ children }: { children: ReactNode }) {
  return children;
}
