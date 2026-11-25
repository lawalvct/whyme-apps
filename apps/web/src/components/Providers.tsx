'use client';

import { Suspense, useEffect, useState, type ReactNode } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { NuqsAdapter } from 'nuqs/adapters/next/app';
import { ApiProvider, createQueryClient, OfflineCacheProvider, syncStatusStore } from '@whyme/data';
import { createWebApiClient } from '@/lib/api';
import { webOfflineCache } from '@/lib/offline';
import { TermsGate } from './auth/TermsGate';
import { OfflineAccount } from './pwa/OfflineAccount';
import { OfflineBanner } from './pwa/OfflineBanner';
import { ServiceWorkerSetup } from './pwa/ServiceWorkerSetup';
import { I18nProvider } from './I18nProvider';

/** App-wide providers: server data, API client, the device's offline copy, URL state, translations. */
export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(createQueryClient);
  const [apiClient] = useState(createWebApiClient);

  // Browser connectivity feeds the global Online / Offline indicator (OFF07).
  useEffect(() => {
    const update = () => syncStatusStore.setState({ online: navigator.onLine });
    update();
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <ApiProvider client={apiClient}>
        <OfflineCacheProvider cache={webOfflineCache}>
          <NuqsAdapter>
            <I18nProvider>
              <OfflineAccount />
              {/* It reads the URL (not over /terms), so it streams in after the page instead of blocking it. */}
              <Suspense fallback={null}>
                <TermsGate />
              </Suspense>
              <OfflineBanner />
              {children}
              <ServiceWorkerSetup />
            </I18nProvider>
          </NuqsAdapter>
        </OfflineCacheProvider>
      </ApiProvider>
    </QueryClientProvider>
  );
}
