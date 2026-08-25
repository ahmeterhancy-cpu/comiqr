import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { NextIntlClientProvider } from 'next-intl';
import MarketingHome from '@/components/marketing-home';
import { marketingMessages } from '@/i18n/request';
import { RTL_LOCALES, type MarketingLocale } from '@/i18n/locales';
import { PATH_LOCALES, faqSchema, marketingMetadata } from '@/lib/marketing-seo';

/**
 * Dile göre adreslenen pazarlama sayfası: /en, /de, /ru, /ar, /bg, /el.
 *
 * Çerez tabanlı dil seçimi panel için yeterli ama halka açık sayfa için değil —
 * arama motoru tek bir adreste tek bir dil görür ve diğerleri hiç indekslenmez.
 * Her dilin kendi adresi olunca hepsi ayrı ayrı indekslenir ve hreflang ile
 * birbirine bağlanır.
 *
 * Bu rota kök seviyede olduğu için bilinmeyen tek segmentli yolları da yakalar;
 * desteklenmeyen bir dil kodu 404 döner, panel yollarını (statik) etkilemez.
 */
export function generateStaticParams() {
  return PATH_LOCALES.map((lang) => ({ lang }));
}

function isMarketingLocale(value: string): value is MarketingLocale {
  return (PATH_LOCALES as readonly string[]).includes(value);
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  const { lang } = await params;
  if (!isMarketingLocale(lang)) return {};

  return marketingMetadata(lang);
}

export default async function LocalisedMarketingPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  if (!isMarketingLocale(lang)) notFound();

  const messages = (await marketingMessages(lang)) as any;
  const rtl = RTL_LOCALES.includes(lang);

  return (
    <NextIntlClientProvider locale={lang} messages={{ marketing: messages }}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema(messages.faq.items, lang)) }}
      />
      {/* Kök <html> yönü proxy başlığına dayanıyor; başlık düşerse burası yine doğru. */}
      <div dir={rtl ? 'rtl' : 'ltr'}>
        <MarketingHome />
      </div>
    </NextIntlClientProvider>
  );
}
