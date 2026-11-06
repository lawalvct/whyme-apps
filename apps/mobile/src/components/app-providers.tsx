import { useEffect, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { focusManager, onlineManager, QueryClientProvider } from '@tanstack/react-query';
import { ApiProvider, createQueryClient, syncStatusStore } from '@whyme/data';
import { createMobileApiClient } from '@/lib/api';
import { activeSync } from '@/lib/sync-runtime';

/**
 * Connectivity drives three things at once: TanStack Query pauses online reads,
 * the global Online / Offline indicator updates (OFF07), and the outbox sends
 * when the connection returns (OFF03).
 */
onlineManager.setEventListener((setOnline) =>
  NetInfo.addEventListener((state) => {
    const online = state.isConnected !== false && state.isInternetReachable !== false;
    setOnline(online);
    const sync = activeSync();
    if (sync) sync.setOnline(online);
    else syncStatusStore.setState({ online });
  }),
);

/** App-wide providers for server data and the API client. */
export function AppProviders({ children }: { children: ReactNode }) {
  const [queryClient] = useState(createQueryClient);
  const [apiClient] = useState(createMobileApiClient);

  // Returning to the foreground: refresh stale data and send queued work.
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (status) => {
      focusManager.setFocused(status === 'active');
      if (status === 'active') void activeSync()?.run();
    });
    return () => subscription.remove();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <ApiProvider client={apiClient}>{children}</ApiProvider>
    </QueryClientProvider>
  );
}
