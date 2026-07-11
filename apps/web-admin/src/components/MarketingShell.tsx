'use client';

import type { CSSProperties, ReactNode } from 'react';
import Link from 'next/link';

const ORANGE: CSSProperties = {
  ['--color-brand-50' as string]: '#fff3ec',
  ['--color-brand-100' as string]: '#ffe1ce',
  ['--color-brand-500' as string]: '#ea5b1a',
  ['--color-brand-600' as string]: '#c9490f',
  ['--color-brand-700' as string]: '#9e3a0c',
};

/** Public marketing chrome (orange) — header + footer for content pages. */
export function MarketingShell({ children }: { children: ReactNode }) {
  return (
    <div style={ORANGE} className="flex min-h-screen flex-col bg-canvas text-ink">
      <header className="sticky top-0 z-50 border-b border-line bg-canvas/85 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5">
          <Link href="/" className="flex items-center gap-2.5">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand-500 font-extrabold text-white shadow-sm">Q</span>
            <span className="text-lg font-extrabold tracking-tight">ComiQR</span>
          </Link>
          <div className="flex items-center gap-3">
            <Link href="/" className="hidden text-sm font-semibold text-muted transition hover:text-ink sm:block">Ana Sayfa</Link>
            <Link href="/register" className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-600">Ücretsiz Dene</Link>
          </div>
        </div>
      </header>

      <main className="flex-1">{children}</main>

      <footer className="border-t border-line bg-surface">
        <div className="mx-auto max-w-6xl px-5 py-12">
          <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <div className="flex items-center gap-2.5">
                <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand-500 font-extrabold text-white">Q</span>
                <span className="text-lg font-extrabold tracking-tight">ComiQR</span>
              </div>
              <p className="mt-4 max-w-xs text-sm text-muted">Restoran, otel, bar ve plaj işletmeleri için uçtan uca QR menü, sipariş ve servis platformu.</p>
            </div>
            {([
              ['Platform', [['Özellikler', '/#ozellikler'], ['İşletme türleri', '/#turler'], ['Fiyatlar', '/#fiyatlar'], ['S.S.S.', '/#sss']]],
              ['Başla', [['Ücretsiz kayıt', '/register'], ['Giriş', '/login'], ['Panel', '/dashboard']]],
              ['Şirket', [['İletişim', '/iletisim'], ['Gizlilik', '/gizlilik'], ['Koşullar', '/kosullar']]],
            ] as [string, [string, string][]][]).map(([h, links]) => (
              <div key={h}>
                <h4 className="text-xs font-bold uppercase tracking-widest text-muted">{h}</h4>
                <div className="mt-4 space-y-2.5">
                  {links.map(([l, href]) => (<Link key={l} href={href} className="block text-sm font-medium text-ink/80 transition hover:text-brand-600">{l}</Link>))}
                </div>
              </div>
            ))}
          </div>
          <div className="mt-12 flex flex-wrap justify-between gap-3 border-t border-line pt-6 text-sm text-muted">
            <span>© 2026 ComiQR. Tüm hakları saklıdır.</span>
            <span>Kıbrıs · Türkiye</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

/** Section heading + prose block for legal/content pages. */
export function DocSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="text-lg font-bold tracking-tight">{title}</h2>
      <div className="mt-2 space-y-3 text-[15px] leading-relaxed text-muted">{children}</div>
    </section>
  );
}
