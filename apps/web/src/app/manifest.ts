import type { MetadataRoute } from 'next';

/** /manifest.webmanifest: lets people install WHY ME from the browser ("Add to Home Screen"). */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'WHY ME: buy, sell and hire in Delta State',
    short_name: 'WHY ME',
    description: 'Products, services and jobs in Delta State, with protected payments.',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: '#FFFFFF',
    theme_color: '#027F45',
    icons: [
      { src: '/brand/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/brand/icon-512.png', sizes: '512x512', type: 'image/png' },
      { src: '/brand/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
