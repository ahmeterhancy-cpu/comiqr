'use client';

import type { CSSProperties } from 'react';
import Link from 'next/link';
import { BrandLogo } from './BrandLogo';

/* Orange brand scope — keeps the public funnel (landing → register/login) consistent. */
const ORANGE: CSSProperties = {
  ['--color-brand-50' as string]: '#fff3ec',
  ['--color-brand-100' as string]: '#ffe1ce',
  ['--color-brand-500' as string]: '#ea5b1a',
  ['--color-brand-600' as string]: '#c9490f',
  ['--color-brand-700' as string]: '#9e3a0c',
};

const STATS: [string, string, string][] = [
  ['1.000+', 'İşletme güveniyor', 'M16 20a4 4 0 0 0-8 0M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8M21 20a3.5 3.5 0 0 0-4-3.9M17 4.5a3 3 0 0 1 0 6'],
  ['5.000.000+', 'Aylık görüntülenme', 'M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7zM12 12a2.5 2.5 0 1 0 0-.01'],
  ['30 dk', 'Fotoğraftan menüye', 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 7v5l3 2'],
  ['%99.9', 'Çalışma süresi', 'M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6zM9 12l2 2 4-4'],
];

const FEATURES: { t: string; b: string; d: string; icon: string }[] = [
  { t: 'Fotoğraftan İçe Aktarma', b: 'AI destekli', d: 'Basılı menünüzün fotoğrafını yükleyin; ürün, kategori ve fiyatlar otomatik çıkarılır — elle giriş yok.', icon: 'M4 5h16v14H4zM4 15l4-4 4 4 3-3 5 5M8.5 9.5a1 1 0 1 0 0-.01' },
  { t: 'Sürükle-Bırak Tasarım', b: 'Sıfır öğrenme', d: 'Ürünleri sürükleyip sıralayın, kategoriler arası taşıyın; teknik bilgi gerekmez.', icon: 'M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z' },
  { t: 'Akıllı QR Menü', b: 'Anında erişim', d: 'Şık, taranabilir QR ile menünüz her cihazda anında açılır — temassız ve hızlı.', icon: 'M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM15 15h5M15 20h5M20 15v5' },
  { t: 'Anlık Menü Güncelleme', b: 'Kesintisiz', d: 'Fiyat değiştir, ürün ekle — saniyeler içinde tüm cihazlara canlı yansır.', icon: 'M13 2 4 14h7l-1 8 9-12h-7z' },
  { t: 'Çoklu Dil & Para Birimi', b: '5 dil', d: 'Menünüzü misafirin diline çevirin ve yerel para biriminde gösterin — turizme birebir.', icon: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM3 12h18M12 3c2.5 2.6 2.5 15 0 18M12 3c-2.5 2.6-2.5 15 0 18' },
  { t: 'Sipariş, Servis & Ödeme', b: 'Uçtan uca', d: 'Masadan sipariş, garson çağır, hesap iste ve online ödeme — hepsi tek sistemde.', icon: 'M2 3h3l2.2 12.3a1.5 1.5 0 0 0 1.5 1.2h8.6a1.5 1.5 0 0 0 1.5-1.2L22 7H6.2M9 20a1 1 0 1 0 .01 0M19 20a1 1 0 1 0 .01 0' },
];

function Ico({ d, cls = 'h-[18px] w-[18px]' }: { d: string; cls?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={cls} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d={d} />
    </svg>
  );
}

/** Two-column auth: form (left) + rich value panel (right). Light, orange brand. */
export function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <div style={ORANGE} className="grid min-h-screen lg:grid-cols-2">
      {/* LEFT — form */}
      <main className="flex items-center justify-center bg-surface px-6 py-10">
        <div className="w-full max-w-md">
          <Link href="/" className="mb-6 flex flex-col items-center gap-2.5">
            <BrandLogo className="h-12 w-auto" />
            <span className="text-xs font-semibold text-muted">14 gün ücretsiz deneme · kart gerekmez</span>
          </Link>
          {children}
        </div>
      </main>

      {/* RIGHT — value panel */}
      <aside className="relative hidden overflow-hidden bg-canvas lg:block">
        <div className="pointer-events-none absolute inset-0" style={{ background: 'radial-gradient(600px 320px at 80% 0%, rgba(234,91,26,.12), transparent 60%)' }} />
        <div className="relative flex h-full max-h-screen flex-col overflow-y-auto p-10 xl:p-14">
          <span className="inline-flex w-fit items-center gap-2 rounded-full border border-line bg-surface px-3 py-1 text-xs font-semibold text-brand-700 shadow-sm">
            <span className="h-1.5 w-1.5 rounded-full bg-brand-500" /> 1.000+ işletmenin güveni
          </span>
          <h1 className="mt-5 text-3xl font-extrabold tracking-tight text-brand-600">Devrime katılın</h1>
          <p className="mt-2 text-[15px] text-muted">Gelişmiş dijital menü platformuyla işletmenizi dönüştürün.</p>

          <div className="mt-6 grid grid-cols-2 gap-3">
            {STATS.map(([n, l, ic]) => (
              <div key={l} className="flex items-center gap-3 rounded-2xl border border-line bg-surface p-4 shadow-sm">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-600"><Ico d={ic} cls="h-5 w-5" /></span>
                <div className="min-w-0">
                  <div className="text-lg font-extrabold tracking-tight text-ink">{n}</div>
                  <div className="truncate text-xs text-muted">{l}</div>
                </div>
              </div>
            ))}
          </div>

          <p className="mt-8 text-xs font-bold uppercase tracking-widest text-muted">Neden ComiQR?</p>
          <div className="mt-4 space-y-5">
            {FEATURES.map((f) => (
              <div key={f.t} className="flex gap-3.5">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-600"><Ico d={f.icon} /></span>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-bold text-ink">{f.t}</span>
                    <span className="rounded-full bg-brand-50 px-2 py-0.5 text-[10px] font-bold text-brand-600">{f.b}</span>
                  </div>
                  <p className="mt-0.5 text-[13px] leading-relaxed text-muted">{f.d}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-line pt-5 text-sm text-muted">
            {['30 gün ücretsiz deneme', 'Kurulum ücreti yok', 'İstediğin an iptal'].map((x) => (
              <span key={x} className="inline-flex items-center gap-1.5">
                <svg viewBox="0 0 24 24" className="h-4 w-4 text-brand-500" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9" /><path d="m8.5 12 2.5 2.5L16 9" /></svg>
                {x}
              </span>
            ))}
          </div>
        </div>
      </aside>
    </div>
  );
}
