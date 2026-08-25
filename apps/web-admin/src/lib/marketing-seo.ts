import type { Metadata } from 'next';
import { marketingMessages } from '@/i18n/request';
import { MARKETING_LOCALES, type MarketingLocale } from '@/i18n/locales';
import { TRIAL_DAYS } from './marketing';

/**
 * Pazarlama sayfasının arama motoru katmanı.
 *
 * Türkçe kök (`/`) ve dile göre adreslenen sayfalar (`/en`, `/de`, ...) aynı
 * bileşeni gösteriyor ama iki ayrı sunucu kabuğu kullanıyor. Metadata,
 * hreflang ve yapılandırılmış veri bu yüzden burada tek yerde üretilir —
 * ayrı ayrı yazıldıklarında kök sayfa hreflang'sız kalmıştı.
 */

export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://comiqr.com';

/** Türkçe kökte yayınlanır; diğer diller kendi adresinde. */
export const PATH_LOCALES = MARKETING_LOCALES.filter((l) => l !== 'tr');

export const localePath = (locale: MarketingLocale) => (locale === 'tr' ? '/' : `/${locale}`);

/**
 * Open Graph dil kodları. `og:locale` `dil_BÖLGE` biçimi bekler; yalnızca
 * `el` yazmak spesifikasyona uymaz ve paylaşım önizlemelerinde yok sayılır.
 */
export const OG_LOCALES: Record<MarketingLocale, string> = {
  tr: 'tr_TR',
  en: 'en_GB',
  de: 'de_DE',
  ru: 'ru_RU',
  ar: 'ar_AE',
  bg: 'bg_BG',
  el: 'el_GR',
};

/**
 * Karşılıklı hreflang kümesi — Türkçe kök dahil HER dil sayfasında.
 *
 * Google hreflang'ı yalnız karşılıklı olduğunda kabul eder: A sayfası B'yi
 * gösterip B, A'yı göstermezse küme tamamen yok sayılır. Kök sayfa bu listeyi
 * vermediği sürece diğer altı dilin hreflang'ı da işe yaramıyordu.
 */
export function alternates(current: MarketingLocale) {
  const languages: Record<string, string> = { 'x-default': '/' };
  for (const l of MARKETING_LOCALES) languages[l] = localePath(l);

  return { canonical: localePath(current), languages };
}

/** Metin çeviri dosyasından; deneme süresi tek kaynaktan (TRIAL_DAYS). */
export const withDays = (text: string) => text.replace('{days}', String(TRIAL_DAYS));

export async function marketingMetadata(locale: MarketingLocale): Promise<Metadata> {
  const M = (await marketingMessages(locale)) as any;
  const title = M.meta.title;
  const description = withDays(M.meta.description);

  return {
    metadataBase: new URL(SITE_URL),
    title,
    description,
    alternates: alternates(locale),
    openGraph: {
      type: 'website',
      locale: OG_LOCALES[locale],
      alternateLocale: MARKETING_LOCALES.filter((l) => l !== locale).map((l) => OG_LOCALES[l]),
      url: localePath(locale),
      siteName: 'ComiQR',
      title,
      description,
      images: [{ url: '/comiqr-logo.png', alt: 'ComiQR' }],
    },
    twitter: { card: 'summary_large_image', title, description },
  };
}

/**
 * Arama sonucunda soru-cevap olarak görünebilmesi için FAQPage şeması.
 * `{days}` burada da yerine konur — konmadığında zengin sonuçta ham yer tutucu
 * ("{days} gün ücretsiz") görünüyordu.
 */
export function faqSchema(items: { q: string; a: string }[], locale: MarketingLocale) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    inLanguage: locale,
    mainEntity: items.map(({ q, a }) => ({
      '@type': 'Question',
      name: withDays(q),
      acceptedAnswer: { '@type': 'Answer', text: withDays(a) },
    })),
  };
}
