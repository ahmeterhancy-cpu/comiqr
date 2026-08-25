/**
 * Landing içeriğinin panelden yönetilen katmanı.
 *
 * Çeviri dosyaları VARSAYILAN olarak kalır; süperadminin değiştirdiği alanlar
 * API'den gelip üzerine biner. Bu yön önemli: kayıt yoksa, API kapalıysa ya da
 * çeviriye yeni bir anahtar eklendiyse sayfa yine de eksiksiz basılır — bir
 * CMS'in en kolay bozduğu şey budur.
 *
 * Anahtarlar çeviri ağacının nokta yoludur: `hero.title1`,
 * `sections.finance.points.2`, `faq.items.0.q`.
 */

export type LandingMedia = {
  /** Hero'daki telefonun içine basılan gerçek ekran görüntüsü. */
  heroPhone?: string;
  /** Paylaşım önizlemesi (og:image). */
  ogImage?: string;
  logo?: string;
};

export type LandingPayload = {
  content: Record<string, Record<string, string>>;
  media: LandingMedia;
};

const EMPTY: LandingPayload = { content: {}, media: {} };

/**
 * API adresi burada ayrıca okunur: `lib/api.ts` bir `'use client'` modülü ve
 * bu dosya sunucuda (sayfa basımında) çalışıyor.
 */
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000/v1';

/**
 * Panel katmanını çeker.
 *
 * Sayfa her istekte basıldığı için kısa süreli önbellek kullanılır; panelden
 * yapılan değişiklik en geç bir dakika içinde yayına düşer. API'ye
 * ulaşılamazsa sessizce boş katman döner — landing, API'nin ayakta olmasına
 * BAĞLI OLMAMALI.
 */
export async function fetchLandingPayload(): Promise<LandingPayload> {
  try {
    const response = await fetch(`${API_URL}/landing`, {
      next: { revalidate: 60 },
      headers: { Accept: 'application/json' },
      // Yavaş ya da asılı kalan bir API sayfayı BEKLETMEMELİ; süre dolarsa
      // dosyadaki çeviriyle basılır.
      signal: AbortSignal.timeout(2000),
    });
    if (!response.ok) return EMPTY;

    const body = await response.json();

    return {
      content: body?.data?.content ?? {},
      media: body?.data?.media ?? {},
    };
  } catch {
    return EMPTY;
  }
}

/** Nokta yolunu ağaca yazar; dizi indisleri sayısal parça olarak gelir. */
function setPath(tree: any, path: string, value: string): void {
  const parts = path.split('.');
  let node = tree;

  for (let i = 0; i < parts.length - 1; i += 1) {
    const key = parts[i];
    // Var olmayan dalı YARATMA: panelde artık karşılığı olmayan eski bir
    // anahtar, çeviri ağacına çöp düğüm eklemesin.
    if (node?.[key] === undefined || node[key] === null || typeof node[key] !== 'object') return;
    node = node[key];
  }

  const last = parts[parts.length - 1];
  if (node?.[last] === undefined) return;

  node[last] = value;
}

/** Çeviri ağacının üzerine panel alanlarını bindirir; kaynak ağaç değişmez. */
export function applyOverrides<T>(defaults: T, overrides: Record<string, string> | undefined): T {
  if (!overrides || Object.keys(overrides).length === 0) return defaults;

  const merged = structuredClone(defaults);
  for (const [path, value] of Object.entries(overrides)) setPath(merged, path, value);

  return merged;
}
