import type { Href } from 'expo-router';

/**
 * Notifications point at a website path ("/orders/{id}"); this is the app screen for it, or null
 * when the app has no such screen yet (jobs, plans), so the notice stays a notice.
 */
export function appRoute(link: string | null | undefined): Href | null {
  if (!link) return null;
  const path = link.split('?')[0];
  let match = /^\/orders\/([^/]+)$/.exec(path);
  if (match) return { pathname: '/orders/[id]', params: { id: match[1] } };
  match = /^\/sell\/listings\/([^/]+)$/.exec(path);
  if (match) return { pathname: '/listing-edit/[id]', params: { id: match[1] } };
  match = /^\/listings\/([^/]+)$/.exec(path);
  if (match) return { pathname: '/listing/[id]', params: { id: match[1] } };
  match = /^\/p\/([^/]+)$/.exec(path);
  if (match) return { pathname: '/profile/[id]', params: { id: match[1] } };
  match = /^\/messages\/([^/]+)$/.exec(path);
  if (match) return { pathname: '/chat/[id]', params: { id: match[1] } };
  match = /^\/requests\/([^/]+)$/.exec(path);
  if (match) return { pathname: '/requests/[id]', params: { id: match[1] } };
  if (path === '/requests') return (/[?&]tab=received\b/.test(link) ? '/requests?tab=received' : '/requests') as Href;
  if (path === '/sell/payouts') return '/payouts';
  if (path === '/orders') return '/orders';
  return null;
}
