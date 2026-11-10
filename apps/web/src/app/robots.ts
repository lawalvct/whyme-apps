import type { MetadataRoute } from 'next';
import { absoluteUrl } from '@/lib/seo';

/** /robots.txt: public pages are crawlable; private areas (selling, orders, chat, sign-in) aren't. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: '*', allow: '/', disallow: ['/sell', '/orders', '/messages', '/checkout', '/signin', '/signup'] }],
    sitemap: absoluteUrl('/sitemap.xml'),
  };
}
