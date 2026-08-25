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
export const DEMOS: { slug: string; title: string; desc: string; emoji: string }[] = [
  { slug: 'demo', title: 'Restoran', desc: 'Sepet, masadan sipariş ve kategori akışı.', emoji: '🍽️' },
  { slug: 'demo-otel', title: 'Otel', desc: 'Oda servisi ve odaya yansıtma (folyo).', emoji: '🏨' },
  { slug: 'demo-bar', title: 'Bar', desc: '18+ işaretleri ve Happy Hour indirimi.', emoji: '🍹' },
];

export const demoUrl = (slug: string) => `${CUSTOMER_URL}/${slug}`;

export const FAQS: [string, string][] = [
  ['Menüyü tekrar tekrar bastırıyor musunuz?', 'Fiyat değişti, ürün bitti, kampanya başladı — panelden değiştirdiğiniz an misafirin telefonunda güncellenir. Baskı yok, bekleme yok.'],
  ['Turistler menünüzü okuyamıyor mu?', 'Menü 5 dilde (TR, EN, DE, RU, AR). Misafir kendi dilini seçer; AI asistan da sorularını kendi dilinde yanıtlar.'],
  ['Personel her gün aynı soruları mı yanıtlıyor?', '“Bu glutensiz mi? Kaçta kapanıyorsunuz?” — AI asistan malzeme, alerjen, saat ve kampanyayı bilir, gece gündüz yanıtlar.'],
  ['Siparişleri ve masaları zor mu yönetiyorsunuz?', 'Sipariş misafirin telefonundan, kiosktan ya da garsonun elinden gelsin — hepsi aynı yere düşer. Mutfak ekranı görür, kasa yönetir, fiş kendi istasyonunda basılır.'],
  ['Menünüzün nasıl performans gösterdiğini bilmiyor musunuz?', 'Hangi ürüne kaç kişi baktı, ne kadar sattı, ne kadar kâr bıraktı — reçeteden gelen maliyetle birlikte görürsünüz.'],
  ['Birden fazla şube mi yönetiyorsunuz?', 'Şubeleri tek panelden yönetin; menüyü, masaları ve raporları şubeye göre ayırın.'],
  ['Kurulum ne kadar sürüyor?', `Basılı menünüzün fotoğrafını çekin ya da PDF yükleyin; kategori, ürün, fiyat ve alerjenler sayfadan okunup doldurulur. ${TRIAL_DAYS} gün ücretsiz deneyebilir, kart vermeden başlayabilirsiniz.`],
];

/**
 * Bölge ofisleri. Her bölge kendi şirketi ve kendi iletişim kanalıyla çalışıyor;
 * sayfada da böyle gösteriliyor. Birincil kanal Kıbrıs (ürünün merkezi).
 */
export type Office = {
  region: string;
  company?: string;
  site?: string;
  address: string[];
  phone: string;
  email: string;
};

export const OFFICES: Office[] = [
  {
    region: 'Kıbrıs',
    address: ['Zafer Sokak No:1', 'Bellapais, Girne, Kıbrıs'],
    phone: '+90 548 840 4000',
    email: 'info@amesisdijital.com',
  },
  {
    region: 'Türkiye',
    site: 'www.maysila.com',
    address: ['İstasyon Street, Hakim Çağlar Işık Cd.', 'Özen Plaza No:1 D.31 Merkez', 'Edirne, Türkiye'],
    phone: '+90 541 392 77 05',
    email: 'info@maysila.com',
  },
  {
    region: 'İngiltere',
    site: 'www.creafinity.co.uk',
    address: ['71–75 Shelton Street', 'Covent Garden, WC2H 9JQ', 'London, UK'],
    phone: '+44 789 911 86 74',
    email: 'info@creafinity.co.uk',
  },
];

/** Aramaya uygun biçim: yalnız rakam ve baştaki artı. */
export const telHref = (phone: string) => `tel:${phone.replace(/[^\d+]/g, '')}`;

/** Birincil kanal — hero/CTA'da tek numara gösterilecekse bu. */
export const PRIMARY_OFFICE = OFFICES[0]!;
