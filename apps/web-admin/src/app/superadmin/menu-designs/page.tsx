'use client';

import { useEffect, useState } from 'react';
import { Panel } from '@/components/superadmin-ui';
import { ThemeThumb } from '@/components/ThemeThumb';
import { useApi } from '@/lib/useApi';

const CUSTOMER_URL = process.env.NEXT_PUBLIC_CUSTOMER_URL ?? 'http://localhost:3010';

/** Sektör modelleri (dikeyler) — kaynak: RestaurantSettings::VERTICALS. */
const VERTICALS = [
  {
    key: 'restaurant',
    icon: '🍽️',
    name: 'Restoran / Kafe',
    area: 'Masa',
    plan: 'Free +',
    desc: 'Masa QR siparişi, gel-al ve teslimat. Nakit/kart ödeme, kupon, sadakat, garson çağır ve değerlendirme.',
    features: ['Masa siparişi', 'Kupon + sadakat', 'Garson çağır', 'Değerlendirme'],
  },
  {
    key: 'hotel',
    icon: '🛏️',
    name: 'Otel',
    area: 'Oda',
    plan: 'Business +',
    desc: 'Oda servisi akışı. Misafir siparişi ödeme yerine "🧾 Odaya Yaz" ile oda folyosuna işleyebilir; çıkışta toplu tahsil edilir.',
    features: ['Oda servisi', 'Odaya yansıt (folyo)', 'Çıkışta tahsilat'],
  },
  {
    key: 'bar',
    icon: '🍹',
    name: 'Bar / Pub',
    area: 'Masa',
    plan: 'Pro +',
    desc: 'Gece / adisyon akışı. Happy hour indirimi menüde otomatik yansır; 18+ ürünlerde sepete eklemeden önce yaş onayı kapısı çıkar.',
    features: ['Happy hour indirimi', '18+ yaş kapısı', 'Adisyon akışı'],
  },
  {
    key: 'beach',
    icon: '⛱️',
    name: 'Plaj Kulübü',
    area: 'Şezlong',
    plan: 'Business +',
    desc: 'Şezlong servisi. Sipariş "🧾 Şezlonga Yaz" ile şezlong folyosuna işlenir (otel folyosuyla aynı mekanizma).',
    features: ['Şezlong servisi', 'Şezlonga yansıt (folyo)', 'Çıkışta tahsilat'],
  },
] as const;

/** Görsel temalar — kaynak: RestaurantSettings::THEMES. */
const THEMES = [
  {
    key: 'modern',
    name: 'Modern',
    tag: 'Varsayılan',
    desc: 'Kart tabanlı çağdaş düzen: ürün fotoğrafı, besin değeri / kalori rozetleri ve yapışkan kategori navigasyonu.',
  },
  {
    key: 'classic',
    name: 'Classic',
    tag: null,
    desc: 'Görsel odaklı: üstte kapak (hero) görseli + yuvarlak logo + hakkında metni, her üründe fotoğraf.',
  },
  {
    key: 'flipbook',
    name: 'Flipbook',
    tag: null,
    desc: 'Basılı menü / dergi estetiği: krem zemin, serif başlıklar, noktalı fiyat çizgileri, fotoğrafsız.',
  },
] as const;

/** Tema önizlemeleri zengin restoran demosu (Girne Meze) üzerinden gösterilir. */
const THEME_PREVIEW_SLUG = 'demo';

/** Paket servis (gel-al/teslimat) demo restoranda açıktır (allow_takeaway/allow_delivery). */
const PACKAGE_PREVIEW_SLUG = 'demo';

type Demo = {
  slug: string;
  name: string;
  theme: string | null;
  area_name: string;
  area_type: string;
  table_code: string;
  qr_token: string;
} | null;

export default function MenuDesignsPage() {
  const { api, ready } = useApi();
  const [demos, setDemos] = useState<Record<string, Demo>>({});
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!ready) return;
    api
      .superMenuModelDemos()
      .then((r) => {
        const map: Record<string, Demo> = {};
        for (const m of r.models) map[m.vertical] = m.demo;
        setDemos(map);
      })
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, [ready, api]);

  return (
    <div className="space-y-6">
      <Panel
        title="Sektör Modelleri"
        right={<span className="text-xs text-muted">4 dikey · canlı sipariş menüsü</span>}
      >
        <p className="mb-5 max-w-3xl text-sm leading-relaxed text-muted">
          Her işletme türü (dikey) QR menüde farklı bir sipariş akışı sunar.{' '}
          <strong>Canlı menü</strong> linkleri gerçek demo işletmenin <em>taranmış</em> QR menüsünü açar —
          otel/plaj folyosu (&quot;Odaya/Şezlonga Yaz&quot;), happy hour ve 18+ yaş kapısı gibi dikeye özel
          davranışlar yalnızca burada görünür. <strong>Salt-okunur</strong> ise menünün siparişsiz halidir.
        </p>

        <div className="grid gap-4 lg:grid-cols-2">
          {VERTICALS.map((v) => {
            const demo = demos[v.key];
            return (
              <div key={v.key} className="flex gap-4 rounded-2xl border border-line bg-surface p-5">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-canvas text-2xl">
                  {v.icon}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-base font-bold text-ink">{v.name}</h3>
                    <span className="rounded-full bg-brand-500/10 px-2 py-0.5 text-[10px] font-semibold text-brand-600">
                      {v.plan}
                    </span>
                    <span className="ml-auto rounded bg-canvas px-1.5 py-0.5 text-[10px] text-muted">
                      Alan: {v.area}
                    </span>
                  </div>

                  <p className="mt-1.5 text-sm leading-relaxed text-muted">{v.desc}</p>

                  <div className="mt-2.5 flex flex-wrap gap-1.5">
                    {v.features.map((f) => (
                      <span key={f} className="rounded-md bg-canvas px-2 py-0.5 text-[11px] text-ink/70">
                        {f}
                      </span>
                    ))}
                  </div>

                  <div className="mt-3.5 flex flex-wrap items-center gap-2">
                    {demo ? (
                      <>
                        <a
                          href={`${CUSTOMER_URL}/m/${demo.qr_token}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 rounded-xl bg-brand-500 px-3.5 py-2 text-sm font-semibold text-white transition hover:bg-brand-600"
                        >
                          Canlı menü ↗
                        </a>
                        <a
                          href={`${CUSTOMER_URL}/${demo.slug}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 rounded-xl border border-line px-3.5 py-2 text-sm font-medium text-ink transition hover:border-brand-500 hover:text-brand-600"
                        >
                          Salt-okunur
                        </a>
                        <span className="text-[11px] text-muted">
                          {demo.name} · {demo.area_name} “{demo.table_code}”
                        </span>
                      </>
                    ) : (
                      <span className="text-[12px] text-muted">
                        {loaded
                          ? 'Bu dikey için demo işletme yok — self-service kayıtla oluşturulabilir.'
                          : 'Yükleniyor…'}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </Panel>

      <Panel
        title="Paket Servis — Gel-Al & Teslimat"
        right={<span className="text-xs text-muted">M20 · pazaryeri kanalı</span>}
      >
        <div className="flex flex-col gap-4 rounded-2xl border border-line bg-surface p-5 lg:flex-row lg:items-center">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-canvas text-3xl">
            🛵
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm leading-relaxed text-muted">
              Dikeyden bağımsız <strong>gel-al &amp; teslimat</strong> kanalı. Misafir masa QR&apos;ı olmadan,
              işletme sayfasından sipariş verir; ad/telefon/adres girer ve <strong>kapıda</strong> (nakit/kart)
              veya <strong>online</strong> (Tiko + kayıtlı kart) öder. İşletme başına{' '}
              <code className="rounded bg-canvas px-1 py-0.5 text-[11px]">allow_takeaway</code> /{' '}
              <code className="rounded bg-canvas px-1 py-0.5 text-[11px]">allow_delivery</code> ile açılır ve{' '}
              <strong>Keşfet</strong> pazaryerinde listelenir.
            </p>
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              {['🛍️ Gel-al', '🛵 Teslimat', '💵 Kapıda ödeme', '💳 Online (Tiko)', '🗺️ Pazaryerinde'].map((f) => (
                <span key={f} className="rounded-md bg-canvas px-2 py-0.5 text-[11px] text-ink/70">
                  {f}
                </span>
              ))}
            </div>
          </div>
          <div className="flex shrink-0 flex-col gap-2">
            <a
              href={`${CUSTOMER_URL}/order/${PACKAGE_PREVIEW_SLUG}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-brand-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-600"
            >
              Örnek paket sipariş ↗
            </a>
            <a
              href={`${CUSTOMER_URL}/discover`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-line px-4 py-2 text-sm font-medium text-ink transition hover:border-brand-500 hover:text-brand-600"
            >
              Pazaryeri (Keşfet) ↗
            </a>
          </div>
        </div>
      </Panel>

      <Panel
        title="Görsel Temalar"
        right={<span className="text-xs text-muted">3 tema · ?theme= önizleme</span>}
      >
        <p className="mb-5 max-w-3xl text-sm leading-relaxed text-muted">
          Dikeyden bağımsız olarak her menü üç görsel düzenden biriyle sunulur. Örnek linkler aynı zengin
          restoran menüsünü (Girne Meze) ilgili temada açar ve işletmenin kayıtlı temasını{' '}
          <strong>değiştirmez</strong>.
        </p>

        <div className="grid gap-4 sm:grid-cols-3">
          {THEMES.map((t) => (
            <div key={t.key} className="flex flex-col rounded-2xl border border-line bg-surface p-4">
              <div className="mb-3 overflow-hidden rounded-lg border border-line/60">
                <ThemeThumb theme={t.key} />
              </div>
              <div className="mb-1 flex items-center gap-2">
                <h3 className="text-sm font-bold text-ink">{t.name}</h3>
                {t.tag && (
                  <span className="rounded-full bg-brand-500/10 px-2 py-0.5 text-[10px] font-semibold text-brand-600">
                    {t.tag}
                  </span>
                )}
                <code className="ml-auto rounded bg-canvas px-1.5 py-0.5 text-[10px] text-muted">{t.key}</code>
              </div>
              <p className="mb-3 flex-1 text-[13px] leading-relaxed text-muted">{t.desc}</p>
              <a
                href={`${CUSTOMER_URL}/${THEME_PREVIEW_SLUG}?theme=${t.key}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-brand-500 py-2 text-sm font-semibold text-white transition hover:bg-brand-600"
              >
                Örnek ↗
              </a>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}
