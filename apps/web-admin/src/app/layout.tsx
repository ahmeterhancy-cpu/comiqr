import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { headers } from 'next/headers';
import { NextIntlClientProvider } from 'next-intl';
import { getLocale, getMessages } from 'next-intl/server';
import { MARKETING_LOCALES, RTL_LOCALES, type MarketingLocale } from '@/i18n/locales';
import { PATHNAME_HEADER } from '@/proxy';
import './globals.css';

const inter = Inter({ subsets: ['latin', 'latin-ext'], variable: '--font-inter' });

const appName = process.env.NEXT_PUBLIC_APP_NAME ?? 'ComiQR';

export const metadata: Metadata = {
  title: `${appName} — Yönetim Paneli`,
  description: 'Multi-tenant QR menu, ordering & operations SaaS.',
};

/**
 * Halka açık pazarlama sayfasının dili — yol belirler, çerez değil.
 *
 * Kök layout paneli de kapsadığı için `<html lang>` panel çerezinden geliyordu
 * ve `/el` sayfası `lang="tr"` yayınlıyordu. Yol `proxy.ts`'in yazdığı başlıktan
 * okunur; başlık yoksa (matcher dışı bir istek) `null` dönüp panel davranışına
 * düşülür.
 */
async function marketingLocaleFromPath(): Promise<MarketingLocale | null> {
  const pathname = (await headers()).get(PATHNAME_HEADER);
  if (!pathname) return null;

  if (pathname === '/') return 'tr';

  const segment = pathname.split('/').filter(Boolean)[0];

  return (MARKETING_LOCALES as readonly string[]).includes(segment)
    ? (segment as MarketingLocale)
    : null;
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const messages = await getMessages();
  // Pazarlama sayfasındaysak sayfanın dili, değilsek panelin çerez dili.
  const locale = (await marketingLocaleFromPath()) ?? (await getLocale());
  const rtl = (RTL_LOCALES as readonly string[]).includes(locale);

  return (
    <html lang={locale} dir={rtl ? 'rtl' : 'ltr'} className={inter.variable}>
      <body className="font-sans antialiased">
        <NextIntlClientProvider messages={messages}>{children}</NextIntlClientProvider>
      </body>
    </html>
  );
}
