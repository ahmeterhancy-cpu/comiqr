import { cookies } from 'next/headers';
import { getRequestConfig } from 'next-intl/server';

// Tourist-facing → 5 locales (CLAUDE.md §i18n). Default TR; fallback TR→EN.
export const LOCALES = ['tr', 'en', 'de', 'ru', 'ar'] as const;
export type AppLocale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: AppLocale = 'tr';

const TRANSLATED: AppLocale[] = ['tr', 'en', 'de', 'ru', 'ar'];

export default getRequestConfig(async () => {
  const store = await cookies();
  const cookieLocale = store.get('locale')?.value as AppLocale | undefined;
  const locale: AppLocale =
    cookieLocale && LOCALES.includes(cookieLocale) ? cookieLocale : DEFAULT_LOCALE;
  const messagesLocale = TRANSLATED.includes(locale) ? locale : 'en';

  return {
    locale,
    messages: (await import(`../../messages/${messagesLocale}.json`)).default,
  };
});
