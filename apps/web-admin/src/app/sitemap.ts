import type { MetadataRoute } from 'next';
import { MARKETING_LOCALES } from '@/i18n/locales';
import { SITE_URL, localePath } from '@/lib/marketing-seo';

/**
 * `/sitemap.xml`.
 *
 * Yalnız halka açık sayfalar: yedi dilin pazarlama adresi ve hukuki/iletişim
 * sayfaları. Panel yolları girişin arkasında, `robots.ts` onları ayrıca kapatır.
 *
 * Pazarlama girdileri `alternates.languages` taşır — site haritasındaki
 * karşılıklı dil bağları, sayfa üzerindeki hreflang etiketlerini tekrarlayıp
 * yeni eklenen dillerin (ru/ar/bg/el) daha çabuk keşfedilmesini sağlar.
 */
const url = (path: string) => new URL(path, SITE_URL).toString();

export default function sitemap(): MetadataRoute.Sitemap {
  const languages = Object.fromEntries(
    MARKETING_LOCALES.map((l) => [l, url(localePath(l))]),
  );

  const landing: MetadataRoute.Sitemap = MARKETING_LOCALES.map((l) => ({
    url: url(localePath(l)),
    changeFrequency: 'weekly',
    // Türkçe kök kanonik giriş; diğer diller onunla eşit ağırlıkta değil.
    priority: l === 'tr' ? 1 : 0.8,
    alternates: { languages },
  }));

  const pages: MetadataRoute.Sitemap = ['/iletisim', '/gizlilik', '/kosullar'].map((path) => ({
    url: url(path),
    changeFrequency: 'yearly',
    priority: 0.3,
  }));

  return [...landing, ...pages];
}
