import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/marketing-seo';

/**
 * `/robots.txt`.
 *
 * Panel yolları zaten girişin arkasında; buradaki amaç indeksleme değil tarama
 * bütçesi — bot her kiracı ekranını denemesin, halka açık sayfalara ve site
 * haritasına yönelsin. `/register` bilerek açık: kayıt sayfası dönüşüm sayfası.
 */
const PANEL_PATHS = [
  '/accounts',
  '/billing',
  '/branches',
  '/campaigns',
  '/coupons',
  '/customers',
  '/dashboard',
  '/expenses',
  '/hotel',
  '/ingredients',
  '/integrations',
  '/login',
  '/menu',
  '/onboarding',
  '/orders',
  '/pos',
  '/printers',
  '/reports',
  '/reviews',
  '/settings',
  '/superadmin',
  '/tables',
  '/users',
  '/waiter',
];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: '*', allow: '/', disallow: ['/api/', ...PANEL_PATHS] }],
    sitemap: new URL('/sitemap.xml', SITE_URL).toString(),
    host: SITE_URL,
  };
}
