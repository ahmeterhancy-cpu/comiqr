/**
 * Pazarlama sayfasının verisi. Hem sunucu bileşeni (metadata + JSON-LD) hem de
 * istemci bileşeni (görünüm) okuduğu için 'use client' taşımaz.
 */

export const CUSTOMER_URL = process.env.NEXT_PUBLIC_CUSTOMER_URL ?? 'http://localhost:3010';

/** Ücretsiz deneme süresi (gün). Kaynağı: TenantOnboardingService::TRIAL_DAYS. */
export const TRIAL_DAYS = 30;

/**
 * Ziyaretçinin ürünü anlatı olarak değil, çalışırken görebileceği menüler.
 * Slug'lar demo seeder'larından gelir (DemoMenuSeeder · DemoHotelSeeder · DemoBarSeeder).
 */
export const DEMOS: { slug: DemoSlug; emoji: string }[] = [
  { slug: 'demo', emoji: '🍽️' },
  { slug: 'demo-otel', emoji: '🏨' },
  { slug: 'demo-bar', emoji: '🍹' },
];

export type DemoSlug = 'demo' | 'demo-otel' | 'demo-bar';

export const demoUrl = (slug: string) => `${CUSTOMER_URL}/${slug}`;


/**
 * Bölge ofisleri. Kart üzerinde yalnız adres ve telefon durur; yazışma tek
 * adresten yürüdüğü için e-posta ofis başına değil, ortak olarak verilir.
 */
export type Office = {
  /** Çeviri anahtarı; görünen ad marketing mesajlarından gelir. */
  key: 'cyprus' | 'turkey' | 'uk';
  address: string[];
  phone: string;
};

/** Tüm bölgeler için tek yazışma adresi. */
export const CONTACT_EMAIL = 'info@comiqr.com';

export const OFFICES: Office[] = [
  {
    key: 'cyprus',
    address: ['Zafer Sokak No:1', 'Bellapais, Girne, Kıbrıs'],
    phone: '+90 548 840 4000',
  },
  {
    key: 'turkey',
    address: ['İstasyon Street, Hakim Çağlar Işık Cd.', 'Özen Plaza No:1 D.31 Merkez', 'Edirne, Türkiye'],
    phone: '+90 541 392 77 05',
  },
  {
    key: 'uk',
    address: ['71–75 Shelton Street', 'Covent Garden, WC2H 9JQ', 'London, UK'],
    phone: '+44 789 911 86 74',
  },
];

/** Aramaya uygun biçim: yalnız rakam ve baştaki artı. */
export const telHref = (phone: string) => `tel:${phone.replace(/[^0-9+]/g, '')}`;

/** Birincil kanal — hero/CTA'da tek numara gösterilecekse bu. */
export const PRIMARY_OFFICE = OFFICES[0]!;

/**
 * Pazarlama metinlerinin şekli. Türkçe dosya kaynak kabul edilir; yeni bir
 * anahtar eklendiğinde tip kendiliğinden büyür ve eksik çeviri derlemede görünür.
 */
export type MarketingContent = typeof import('../../messages/marketing/tr.json');
