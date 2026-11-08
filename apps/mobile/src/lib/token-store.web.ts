/**
 * Web build of the mobile app, used only to preview screens in a browser while
 * developing (`pnpm --filter mobile web`). There is no keychain in a browser, so
 * the token lives in this tab's sessionStorage and disappears with the tab.
 * The public website is the Next.js app, which uses cookie sessions instead.
 */
export const TOKEN_KEY = 'whyme.api_token';

export async function getToken(): Promise<string | null> {
  try {
    return window.sessionStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export async function setToken(token: string): Promise<void> {
  try {
    window.sessionStorage.setItem(TOKEN_KEY, token);
  } catch {
    // Blocked storage: the preview just stays signed out after a reload.
  }
}

export async function clearToken(): Promise<void> {
  try {
    window.sessionStorage.removeItem(TOKEN_KEY);
  } catch {
    // Nothing stored.
  }
}
