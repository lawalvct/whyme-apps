import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useApi } from '@whyme/data';
import { AppProviders } from '@/components/app-providers';
import { SplashOverlay } from '@/components/splash-overlay';
import { TermsGate } from '@/components/terms-gate';
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
        <Stack.Screen name="sign-up" options={{ presentation: 'modal' }} />
        <Stack.Screen name="terms/[type]" />
        <Stack.Screen name="search" />
        <Stack.Screen name="account" />
        <Stack.Screen name="delete-account" />
        <Stack.Screen name="confirm-phone" />
        <Stack.Screen name="payouts" />
        <Stack.Screen name="listing/[id]" />
        <Stack.Screen name="profile/[id]" />
        <Stack.Screen name="checkout/[id]" />
        <Stack.Screen name="my-listings" />
        <Stack.Screen name="listing-edit/[id]" />
        <Stack.Screen name="forgot-password" />
        <Stack.Screen name="requests/index" />
        <Stack.Screen name="requests/new" />
        <Stack.Screen name="requests/[id]" />
        <Stack.Screen name="notifications" />
        <Stack.Screen name="orders/[id]" />
        <Stack.Screen name="chat/[id]" />
      </Stack>
      {ready ? <TermsGate /> : null}
      <SplashOverlay ready={ready} />
    </>
  );
}
