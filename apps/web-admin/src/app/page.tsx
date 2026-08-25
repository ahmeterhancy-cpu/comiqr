import type { Metadata } from 'next';
import MarketingHome from '@/components/marketing-home';
import { getMessages } from 'next-intl/server';
import { TRIAL_DAYS } from '@/lib/marketing';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://comiqr.com';

/**
 * Pazarlama sayfasının sunucu kabuğu.
 *
 * Görünüm istemci bileşeninde (durum, kaydırma, sekmeler) ama `metadata` ve
 * yapılandırılmış veri sunucuda üretilmek zorunda — Next istemci bileşeninden
 * metadata dışa aktarılmasına izin vermez. Bu ayrım olmadan sayfa, yönetim
 * panelinin İngilizce ve jenerik açıklamasını miras alıyordu.
 */
export async function generateMetadata(): Promise<Metadata> {
  const M = ((await getMessages()) as any).marketing;
  const title = M.meta.title;
  const description = M.meta.description.replace('{days}', String(TRIAL_DAYS));

  return {
    metadataBase: new URL(SITE_URL),
    title,
    description,
    alternates: { canonical: '/' },
    openGraph: {
      type: 'website',
      url: '/',
      siteName: 'ComiQR',
      title,
      description,
      images: [{ url: '/comiqr-logo.png', alt: 'ComiQR' }],
    },
    twitter: { card: 'summary_large_image', title, description },
  };
}

/** Arama sonucunda soru-cevap olarak görünebilmesi için FAQPage şeması. */
function faqSchema(items: { q: string; a: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: items.map(({ q, a }) => ({
      '@type': 'Question',
      name: q,
      acceptedAnswer: { '@type': 'Answer', text: a },
    })),
  };
}

export default async function Page() {
  const M = ((await getMessages()) as any).marketing;

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema(M.faq.items)) }}
      />
      <MarketingHome />
    </>
  );
}
