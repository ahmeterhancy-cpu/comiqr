import { cookies } from 'next/headers';
import { getRequestConfig } from 'next-intl/server';

// Supported UI locales (docs CLAUDE.md §i18n). Default TR; fallback TR→EN.
export const LOCALES = ['tr', 'en', 'de', 'ru', 'ar'] as const;
export type AppLocale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: AppLocale = 'tr';

// Locales with their own message file; any others fall back to EN messages.
const TRANSLATED: AppLocale[] = ['tr', 'en', 'de', 'ru', 'ar'];

import { MARKETING_LOCALES } from './locales';

export { MARKETING_LOCALES, MARKETING_LOCALE_NAMES, RTL_LOCALES } from './locales';
export type { MarketingLocale } from './locales';

/**
 * Çevirisi eksikse Türkçeye düşer; sayfa hiçbir zaman boş anahtar göstermez.
 * Dosya henüz yazılmamış bir dil de (çeviri sırada) hata vermek yerine Türkçe
 * yayınlanır — yarım bir sayfa, bozuk bir sayfadan iyidir.
 */
export async function marketingMessages(locale: string) {
  const key = (MARKETING_LOCALES as readonly string[]).includes(locale) ? locale : 'tr';

  try {
    return (await import(`../../messages/marketing/${key}.json`)).default;
  } catch {
    return (await import('../../messages/marketing/tr.json')).default;
  }
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
