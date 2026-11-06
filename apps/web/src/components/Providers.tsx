'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { NuqsAdapter } from 'nuqs/adapters/next/app';
import { ApiProvider, createQueryClient, syncStatusStore } from '@whyme/data';
import { createWebApiClient } from '@/lib/api';
import { I18nProvider } from './I18nProvider';

/** App-wide providers: server data, API client, URL state, translations. */
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
        <NuqsAdapter>
          <I18nProvider>{children}</I18nProvider>
        </NuqsAdapter>
      </ApiProvider>
    </QueryClientProvider>
  );
}
