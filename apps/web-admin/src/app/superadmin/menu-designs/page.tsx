'use client';

import { Panel } from '@/components/superadmin-ui';

const CUSTOMER_URL = process.env.NEXT_PUBLIC_CUSTOMER_URL ?? 'http://localhost:3010';

/** Üç QR menü teması (apps/web-customer/src/components/menu.tsx). */
const THEMES = [
  {
    key: 'modern',
    name: 'Modern',
    emoji: '🧊',
    tag: 'Varsayılan',
    desc: 'Görsel ağırlıklı, kart tabanlı çağdaş düzen. Ürün fotoğrafları, alerjen rozetleri ve hızlı sepet için ideal — çoğu işletme için önerilir.',
    accent: 'from-teal-500 to-emerald-600',
  },
  {
    key: 'classic',
    name: 'Classic',
    emoji: '📜',
    desc: 'Sade, basılı menü hissi veren tipografik liste düzeni. Fotoğrafsız, hızlı taranır; fine-dining, kahve ve şarap menüleri için uygun.',
    accent: 'from-amber-500 to-orange-600',
  },
  {
    key: 'flipbook',
    name: 'Flipbook',
    emoji: '📖',
    desc: 'Sayfa çevirmeli kitapçık deneyimi. Her kategori ayrı bir sayfa gibi; sunum ve marka hikayesi güçlü menüler için.',
    accent: 'from-indigo-500 to-violet-600',
  },
] as const;

/** Zengin içerikli demo işletmeler — her tema bunlarla önizlenebilir. */
const DEMOS = [
  { slug: 'demo', label: 'Girne Meze', hint: 'restoran' },
  { slug: 'demo-bar', label: 'Efsane Bar', hint: 'bar' },
  { slug: 'demo-otel', label: 'Deniz Kızı', hint: 'otel' },
] as const;

export default function MenuDesignsPage() {
  return (
    <Panel
      title="QR Menü Tasarımları"
      right={<span className="text-xs text-muted">3 tema · canlı önizleme</span>}
    >
      <p className="mb-5 max-w-3xl text-sm leading-relaxed text-muted">
        Her işletme, QR menüsü için aşağıdaki üç tasarımdan birini seçer (İşletme → Ayarlar → Görünüm).
        Aşağıdaki örnek linkler gerçek demo menüleri ilgili temada açar ve işletmenin kayıtlı
        ayarını <strong>değiştirmez</strong> — <code className="rounded bg-canvas px-1 py-0.5 text-[11px]">?theme=</code> yalnızca önizleme amaçlıdır.
      </p>

      <div className="grid gap-4 lg:grid-cols-3">
        {THEMES.map((t) => (
          <div key={t.key} className="flex flex-col overflow-hidden rounded-2xl border border-line bg-surface">
            <div className={`flex h-24 items-center justify-center bg-gradient-to-br ${t.accent}`}>
              <span className="text-4xl drop-shadow">{t.emoji}</span>
            </div>

            <div className="flex flex-1 flex-col p-5">
              <div className="mb-2 flex items-center gap-2">
                <h3 className="text-base font-bold text-ink">{t.name}</h3>
                {'tag' in t && t.tag && (
                  <span className="rounded-full bg-brand-500/10 px-2 py-0.5 text-[10px] font-semibold text-brand-600">
                    {t.tag}
                  </span>
                )}
                <code className="ml-auto rounded bg-canvas px-1.5 py-0.5 text-[10px] text-muted">{t.key}</code>
              </div>

              <p className="mb-4 flex-1 text-sm leading-relaxed text-muted">{t.desc}</p>

              <a
                href={`${CUSTOMER_URL}/v/demo?theme=${t.key}`}
                target="_blank"
                rel="noopener noreferrer"
                className="mb-3 inline-flex items-center justify-center gap-1.5 rounded-xl bg-brand-500 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-600"
              >
                Örnek Menüyü Aç ↗
              </a>

              <div className="flex flex-wrap gap-1.5">
                {DEMOS.map((d) => (
                  <a
                    key={d.slug}
                    href={`${CUSTOMER_URL}/v/${d.slug}?theme=${t.key}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    title={`${d.label} — ${t.name} temasıyla`}
                    className="rounded-lg border border-line px-2.5 py-1 text-[11px] font-medium text-muted transition hover:border-brand-500 hover:text-brand-600"
                  >
                    {d.label}
                    <span className="ml-1 text-[9px] uppercase tracking-wide opacity-60">{d.hint}</span>
                  </a>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>

      <p className="mt-5 text-xs text-muted">
        İşletme kendi menüsünü <code className="rounded bg-canvas px-1 py-0.5">{'<müşteri-uygulaması>/v/<slug>'}</code> adresinde,
        panelinde seçtiği temayla yayınlar. Örnek linkler yeni sekmede açılır.
      </p>
    </Panel>
  );
}
