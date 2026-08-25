import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { NextIntlClientProvider } from 'next-intl';
import MarketingHome from '@/components/marketing-home';
import { marketingMessages } from '@/i18n/request';
import { MARKETING_LOCALES, RTL_LOCALES, type MarketingLocale } from '@/i18n/locales';
import { TRIAL_DAYS } from '@/lib/marketing';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://comiqr.com';

/** Türkçe kökte (/) yayınlanır; diğer diller kendi adresinde. */
const PATH_LOCALES = MARKETING_LOCALES.filter((l) => l !== 'tr');

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

/** Her dil için karşılıklı hreflang; Türkçe kök adresi x-default. */
function alternates(current: string) {
  const languages: Record<string, string> = { tr: '/', 'x-default': '/' };
  for (const l of PATH_LOCALES) languages[l] = `/${l}`;

  return { canonical: current === 'tr' ? '/' : `/${current}`, languages };
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  const { lang } = await params;
  if (!isMarketingLocale(lang)) return {};

  const M = (await marketingMessages(lang)) as any;
  const title = M.meta.title;
  const description = M.meta.description.replace('{days}', String(TRIAL_DAYS));

  return {
    metadataBase: new URL(SITE_URL),
    title,
    description,
    alternates: alternates(lang),
    openGraph: {
      type: 'website',
      locale: lang,
      url: `/${lang}`,
      siteName: 'ComiQR',
      title,
      description,
      images: [{ url: '/comiqr-logo.png', alt: 'ComiQR' }],
    },
    twitter: { card: 'summary_large_image', title, description },
  };
}

export default async function LocalisedMarketingPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  if (!isMarketingLocale(lang)) notFound();

  const messages = await marketingMessages(lang);
  const rtl = RTL_LOCALES.includes(lang);

  return (
    <NextIntlClientProvider locale={lang} messages={{ marketing: messages }}>
      {/* Kök <html> paneli de kapsadığı için yön burada, sayfa sarmalında verilir. */}
      <div dir={rtl ? 'rtl' : 'ltr'}>
        <MarketingHome />
      </div>
    </NextIntlClientProvider>
  );
}
