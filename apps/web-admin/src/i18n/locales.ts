/**
 * Dil sabitleri — hem sunucuda hem istemcide kullanılabilsin diye ayrı dosyada.
 * `request.ts` `next/headers` kullandığı için istemci bileşenlerinden import
 * edilemez; dil listesini oradan almak istemci paketini bozuyordu.
 */

/**
 * Pazarlama sayfası panelden daha çok dil konuşur: Bulgarca ve Yunanca yalnız
 * landing için var (Edirne ofisinin komşu pazarları), panelde karşılıkları yok.
 */
export const MARKETING_LOCALES = ['tr', 'en', 'de', 'ru', 'ar', 'bg', 'el'] as const;
export type MarketingLocale = (typeof MARKETING_LOCALES)[number];

export const MARKETING_LOCALE_NAMES: Record<MarketingLocale, string> = {
  tr: 'Türkçe',
  en: 'English',
  de: 'Deutsch',
  ru: 'Русский',
  ar: 'العربية',
  bg: 'Български',
  el: 'Ελληνικά',
};

/** Sağdan sola yazılan diller. */
export const RTL_LOCALES: readonly MarketingLocale[] = ['ar'];
