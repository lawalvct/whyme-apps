import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useApi } from '@whyme/data';
import { AppProviders } from '@/components/app-providers';
import { SplashOverlay } from '@/components/splash-overlay';
import '@/lib/i18n';
import { bootSession } from '@/lib/session';
import { color } from '@/theme';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  return (
    <AppProviders>
      <StatusBar style="dark" />
      <SessionGate />
    </AppProviders>
  );
}

/** Restores the signed-in account before the first screen, behind the WHY ME splash. */
function SessionGate() {
  const api = useApi();
  const queryClient = useQueryClient();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // Never keep someone on the splash: after 6 seconds the app opens and catches up.
    const limit = setTimeout(() => setReady(true), 6000);
    void bootSession(api, queryClient).finally(() => {
      clearTimeout(limit);
      setReady(true);
    });
    return () => clearTimeout(limit);
  }, [api, queryClient]);

  return (
    <>
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: color.canvas } }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="sign-in" options={{ presentation: 'modal' }} />
        <Stack.Screen name="search" />
        <Stack.Screen name="account" />
        <Stack.Screen name="notifications" />
        <Stack.Screen name="orders/[id]" />
        <Stack.Screen name="chat/[id]" />
      </Stack>
      <SplashOverlay ready={ready} />
    </>
  );
}
