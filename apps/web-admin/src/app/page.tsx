import type { Metadata } from 'next';
import MarketingHome from '@/components/marketing-home';
import { FAQS, TRIAL_DAYS } from '@/lib/marketing';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://comiqr.com';
const TITLE = 'ComiQR — QR menü, masadan sipariş ve restoran yönetimi';
const DESCRIPTION =
  `Dijital QR menü ile başlayın; masadan sipariş, mutfak ekranı, personel POS ve gider-kâr raporu aynı panelde. ` +
  `Beş dil, kurulum ücreti yok, ${TRIAL_DAYS} gün ücretsiz.`;

/**
 * Pazarlama sayfasının sunucu kabuğu.
 *
 * Görünüm istemci bileşeninde (durum, kaydırma, sekmeler) ama `metadata` ve
 * yapılandırılmış veri sunucuda üretilmek zorunda — Next istemci bileşeninden
 * metadata dışa aktarılmasına izin vermez. Bu ayrım olmadan sayfa, yönetim
 * panelinin İngilizce ve jenerik açıklamasını miras alıyordu.
 */
export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: '/' },
  openGraph: {
    type: 'website',
    locale: 'tr_TR',
    url: '/',
    siteName: 'ComiQR',
    title: TITLE,
    description: DESCRIPTION,
    images: [{ url: '/comiqr-logo.png', alt: 'ComiQR' }],
  },
  twitter: { card: 'summary_large_image', title: TITLE, description: DESCRIPTION },
};

/** Arama sonucunda soru-cevap olarak görünebilmesi için FAQPage şeması. */
function faqSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: FAQS.map(([question, answer]) => ({
      '@type': 'Question',
      name: question,
      acceptedAnswer: { '@type': 'Answer', text: answer },
    })),
  };
}

export default function Page() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema()) }}
      />
      <MarketingHome />
    </>
  );
}
