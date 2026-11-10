import type { Metadata } from 'next';
import { OfflinePage } from '@/components/pwa/OfflinePage';

export const metadata: Metadata = {
  title: 'Offline',
  robots: { index: false, follow: false },
};

/** Shown by the service worker when a page that wasn't saved on this device is opened offline. */
export default function Offline() {
  return <OfflinePage />;
}
