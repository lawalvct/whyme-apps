import type { QueryClient } from '@tanstack/react-query';
import { queryKeys, signedIn, signedOut, unwrap, useSession, type ApiClient, type Me } from '@whyme/data';
import { appDevice } from './device';
import { deviceStorage } from './device-storage';
import { clearToken, getToken, setToken } from './token-store';

const ME_KEY = 'whyme.me';

function savedMe(): Me | null {
  try {
    const value = deviceStorage.getItem(ME_KEY);
    return value ? (JSON.parse(value) as Me) : null;
  } catch {
    return null;
  }
}

function remember(user: Me | null): void {
  deviceStorage.setItem(ME_KEY, user ? JSON.stringify(user) : '');
}

/**
 * At start-up: with a saved token, load the account (or show the device's copy while offline);
 * a refused token signs the phone out. The token stays in the keychain/keystore (ACC03).
 */
export async function bootSession(api: ApiClient, queryClient: QueryClient): Promise<void> {
  const token = await getToken();
  if (!token) {
    signedOut();
    return;
  }
  const copy = savedMe();
  try {
    const { data, response } = await api.GET('/v1/me');
    if (response.status === 401 || response.status === 403) {
      await clearToken();
      remember(null);
      signedOut();
      return;
    }
    const user = data?.data ?? copy;
    if (!user) {
      signedOut();
      return;
    }
    remember(user);
    queryClient.setQueryData(queryKeys.me, user);
    signedIn(user);
  } catch {
    // Offline: keep the person signed in with the copy from their last visit.
    if (copy) signedIn(copy);
    else signedOut();
  }
}

export type SignInResult = { done: true } | { done: false; channel: string; sentTo: string };

/** Phone and password; a new device may need a code first (sent by SMS or email). */
export async function signIn(api: ApiClient, queryClient: QueryClient, values: { phone: string; password: string; code?: string | null }): Promise<SignInResult> {
  const body = unwrap(
    await api.POST('/v1/auth/login', {
      body: { phone: values.phone, password: values.password, code: values.code || null, device: appDevice() },
    }),
  );
  if ('otp_required' in body.data) {
    return { done: false, channel: String(body.data.channel), sentTo: body.data.sent_to };
  }
  if (body.data.token) await setToken(body.data.token);
  const user = body.data.user;
  remember(user);
  queryClient.setQueryData(queryKeys.me, user);
  signedIn(user);
  return { done: true };
}

export async function signOut(api: ApiClient, queryClient: QueryClient): Promise<void> {
  try {
    await api.POST('/v1/auth/logout');
  } catch {
    // Offline: the token is forgotten on this phone either way.
  }
  await clearToken();
  remember(null);
  queryClient.clear();
  signedOut();
}

/** Keeps the session copy in step after the account changes (name, language, terms). */
export function updateMe(queryClient: QueryClient, user: Me): void {
  remember(user);
  queryClient.setQueryData(queryKeys.me, user);
  signedIn(user);
}

export function useAccount() {
  const status = useSession((s) => s.status);
  const user = useSession((s) => s.user);
  return { status, user };
}
