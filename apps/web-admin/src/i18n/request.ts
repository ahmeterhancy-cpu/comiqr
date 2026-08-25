import { cookies } from 'next/headers';
import { getRequestConfig } from 'next-intl/server';

// Supported UI locales (docs CLAUDE.md §i18n). Default TR; fallback TR→EN.
export const LOCALES = ['tr', 'en', 'de', 'ru', 'ar'] as const;
export type AppLocale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: AppLocale = 'tr';

// Locales with their own message file; any others fall back to EN messages.
const TRANSLATED: AppLocale[] = ['tr', 'en', 'de', 'ru', 'ar'];

/**
 * Pazarlama sayfası panelden daha çok dil konuşur: Bulgarca ve Yunanca yalnız
 * landing için var (Edirne ofisinin komşu pazarları), panelde karşılıkları yok.
 * Bu yüzden `marketing` kümesi ayrı dosyalarda tutulur ve panel mesajlarının
 * üstüne eklenir — panelin dil listesi bundan etkilenmez.
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

/** Çevirisi eksikse Türkçeye düşer; sayfa hiçbir zaman boş anahtar göstermez. */
export async function marketingMessages(locale: string) {
  const key = (MARKETING_LOCALES as readonly string[]).includes(locale) ? locale : 'tr';

  return (await import(`../../messages/marketing/${key}.json`)).default;
}

export default getRequestConfig(async () => {
  const store = await cookies();
  const cookieLocale = store.get('locale')?.value as AppLocale | undefined;
  const locale: AppLocale =
    cookieLocale && LOCALES.includes(cookieLocale) ? cookieLocale : DEFAULT_LOCALE;

  const messagesLocale = TRANSLATED.includes(locale) ? locale : 'en';
  const messages = (await import(`../../messages/${messagesLocale}.json`)).default;

  return {
    locale,
    messages: { ...messages, marketing: await marketingMessages(locale) },
  };
});
