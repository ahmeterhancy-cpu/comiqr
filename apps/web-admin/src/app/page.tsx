import type { Metadata } from 'next';
import { NextIntlClientProvider } from 'next-intl';
import MarketingHome from '@/components/marketing-home';
import { marketingMessages } from '@/i18n/request';
import { faqSchema, marketingMetadata } from '@/lib/marketing-seo';
import { fetchLandingPayload } from '@/lib/landing-content';

/**
 * Pazarlama sayfasının Türkçe kökü (`/`).
 *
 * Görünüm istemci bileşeninde (durum, kaydırma, sekmeler) ama `metadata` ve
 * yapılandırılmış veri sunucuda üretilmek zorunda — Next istemci bileşeninden
 * metadata dışa aktarılmasına izin vermez.
 *
 * Metin çerezden DEĞİL, sabit Türkçeden gelir. Bu adresin kanonik dili
 * hreflang'da `tr` olarak ilan ediliyor; panel çerezine göre değişen bir gövde
 * aynı URL'i ziyaretçiden ziyaretçiye başka dilde gösterip yinelenen içerik
 * sinyali üretiyordu. Ziyaretçi dilini sayfadaki seçiciden `/en`, `/de` ...
 * adresine geçerek değiştirir.
 */
export function generateMetadata(): Promise<Metadata> {
  return marketingMetadata('tr');
}

export default async function Page() {
  const messages = (await marketingMessages('tr')) as any;
  const { media } = await fetchLandingPayload();

  return (
    <NextIntlClientProvider locale="tr" messages={{ marketing: messages }}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema(messages.faq.items, 'tr')) }}
      />
      <MarketingHome media={media} />
    </NextIntlClientProvider>
  );
}
