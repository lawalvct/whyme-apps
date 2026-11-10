/*
 * WHY ME service worker (docs/01 §6.6, WEB02). Hand-written rather than generated, so every
 * rule is visible here:
 *
 * - The site's code (/_next/static, content-hashed) is kept after first use: cache first.
 * - Pages you open are kept: network first, the kept copy when offline, else /offline.
 *   Private pages are empty shells (their data comes from the account's IndexedDB), so
 *   keeping their HTML is safe; sign-in, sign-up and checkout are never kept.
 * - Listing photos from the media server are kept when it allows it (CORS), capped.
 * - The API is never cached here: private data lives in the account's IndexedDB.
 *
 * A new version waits until the page asks it to take over ("New version – Refresh"), so it
 * never reloads the site under someone with unsent work.
 */
const VERSION = 'v1';
const STATIC = `whyme-static-${VERSION}`;
const PAGES = `whyme-pages-${VERSION}`;
const IMAGES = `whyme-images-${VERSION}`;
const OFFLINE_URL = '/offline';
const PRECACHE = [OFFLINE_URL, '/manifest.webmanifest', '/brand/icon-192.png', '/brand/icon-512.png', '/brand/whyme-mark.png'];
const MAX_PAGES = 80;
const MAX_IMAGES = 300;
const NEVER_KEEP = [/^\/signin/, /^\/signup/, /^\/checkout/];

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(STATIC);
      await cache.addAll(PRECACHE);
      // The offline page's own code and styles too, so it works fully without a connection.
      const html = await (await cache.match(OFFLINE_URL))?.text();
      const assets = [...new Set((html ?? '').match(/\/_next\/static\/[^"'\s)]+/g) ?? [])];
      await Promise.all(assets.map((url) => cache.add(url).catch(() => undefined)));
    })(),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const current = new Set([STATIC, PAGES, IMAGES]);
      for (const key of await caches.keys()) {
        if (key.startsWith('whyme-') && !current.has(key)) await caches.delete(key);
      }
      await self.clients.claim();
    })(),
  );
});

self.addEventListener('message', (event) => {
  const type = event.data && event.data.type;
  if (type === 'SKIP_WAITING') self.skipWaiting();
  // After sign-out: drop the pages kept for that person.
  if (type === 'CLEAR_PAGES') event.waitUntil(caches.delete(PAGES));
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);

  if (url.origin !== self.location.origin) {
    if (request.destination === 'image' && url.pathname.includes('/storage/media/')) {
      event.respondWith(mediaImage(request));
    }
    return; // the API and everything else on other origins: straight to the network
  }

  if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith(cacheFirst(STATIC, request));
    return;
  }
  if (url.pathname.startsWith('/_next/') || url.pathname === '/sw.js') return;

  if (request.mode === 'navigate') {
    event.respondWith(page(request, url));
    return;
  }

  // A page's data for in-app navigation: network only. When it fails offline, Next.js falls
  // back to loading the whole page, which `page` then serves from the kept copy.
  if (request.headers.get('RSC') === '1') return;

  if (['image', 'font', 'style', 'script', 'manifest'].includes(request.destination)) {
    event.respondWith(staleWhileRevalidate(STATIC, request));
  }
});

async function page(request, url) {
  const cache = await caches.open(PAGES);
  const keep = !NEVER_KEEP.some((pattern) => pattern.test(url.pathname));
  try {
    const response = await fetch(request);
    if (keep && response.ok && response.type === 'basic') {
      await cache.put(request, response.clone());
      await trim(PAGES, MAX_PAGES);
    }
    return response;
  } catch {
    const kept = keep ? (await cache.match(request)) || (await cache.match(request, { ignoreSearch: true })) : undefined;
    return kept || (await caches.match(OFFLINE_URL)) || Response.error();
  }
}

async function cacheFirst(name, request) {
  const cache = await caches.open(name);
  const hit = await cache.match(request);
  if (hit) return hit;
  const response = await fetch(request);
  if (response.ok) await cache.put(request, response.clone());
  return response;
}

async function staleWhileRevalidate(name, request) {
  const cache = await caches.open(name);
  const hit = await cache.match(request);
  const fresh = fetch(request)
    .then(async (response) => {
      if (response.ok) await cache.put(request, response.clone());
      return response;
    })
    .catch(() => undefined);
  return hit || (await fresh) || Response.error();
}

/**
 * Listing photos. Kept only when the media server sends CORS headers: an opaque copy
 * counts as several megabytes against the browser's storage and could crowd out unsent work.
 */
async function mediaImage(request) {
  const cache = await caches.open(IMAGES);
  const hit = await cache.match(request.url);
  if (hit) return hit;
  try {
    const response = await fetch(request.url, { mode: 'cors', credentials: 'omit' });
    if (response.ok) {
      await cache.put(request.url, response.clone());
      await trim(IMAGES, MAX_IMAGES);
    }
    return response;
  } catch {
    return fetch(request);
  }
}

async function trim(name, max) {
  const cache = await caches.open(name);
  const keys = await cache.keys();
  for (let i = 0; i < keys.length - max; i++) await cache.delete(keys[i]);
}
