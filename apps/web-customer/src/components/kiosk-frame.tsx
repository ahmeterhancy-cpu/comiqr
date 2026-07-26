'use client';

import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { OrderableMenu } from '@/components/orderable-menu';
import type { Menu, MenuVenue } from '@comiqr/shared-types';

type Phase = 'attract' | 'browse' | 'order';

function accentOf(venue: MenuVenue): string {
  const c = venue.menu_button_color ?? (venue as any).brand_color;
  return typeof c === 'string' && /^#[0-9a-fA-F]{6}$/.test(c) ? c : 'var(--color-navy)';
}

/**
 * Self-service kiosk (M16) — a stationary tablet at the venue, portrait-optimised.
 * Three phases: an attract/welcome screen → a branded browse landing (hero +
 * featured + categories) → the full ordering flow (OrderableMenu). "New order"
 * reloads to a clean cart, returning to the attract screen for the next guest.
 */
export function KioskFrame({ menu, qrToken, tableCode }: { menu: Menu; qrToken: string; tableCode?: string }) {
  const t = useTranslations('kiosk');
  const [phase, setPhase] = useState<Phase>('attract');

  if (phase === 'attract') return <KioskAttract menu={menu} onStart={() => setPhase('browse')} />;
  if (phase === 'browse') {
    return <KioskMenu menu={menu} tableCode={tableCode} onEnter={() => setPhase('order')} onStartOver={() => window.location.reload()} />;
  }

  return (
    <div className="min-h-screen bg-canvas">
      <div className="sticky top-0 z-30 flex items-center justify-between border-b border-line bg-[color:var(--color-navy)] px-5 py-3 text-white">
        <button
          onClick={() => setPhase('browse')}
          className="rounded-full bg-white/15 px-4 py-1.5 text-sm font-semibold backdrop-blur transition hover:bg-white/25"
          style={{ color: '#ffffff' }}
        >
          ‹ {t('title')}
        </button>
        <button
          onClick={() => window.location.reload()}
          className="rounded-full bg-white/15 px-4 py-1.5 text-sm font-semibold backdrop-blur transition hover:bg-white/25"
          style={{ color: '#ffffff' }}
        >
          {t('newOrder')}
        </button>
      </div>
      <OrderableMenu menu={menu} qrToken={qrToken} tableCode={tableCode} terminalPay />
    </div>
  );
}

/** Kiosk giriş/bekleme (attract) ekranı — logo + mekan + CTA + yemek görselleri. */
function KioskAttract({ menu, onStart }: { menu: Menu; onStart: () => void }) {
  const t = useTranslations('kiosk');
  const photos = useMemo(() => {
    const imgs: string[] = [];
    for (const c of menu.categories) for (const p of c.products) if (p.images?.[0]) imgs.push(p.images[0]);
    return imgs;
  }, [menu]);
  const brand = accentOf(menu.venue);
  const top = photos.slice(0, 3);
  const bottom = photos.slice(3, 6);

  const strip = (list: string[], flip: boolean) => (
    <div className="flex w-full items-center justify-center gap-4 px-6">
      {list.map((src, i) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={i}
          src={src}
          alt=""
          className={`h-28 w-28 rounded-3xl bg-canvas object-cover shadow-[var(--shadow-card)] ${
            (i % 2 === 0) === flip ? 'rotate-6' : '-rotate-6'
          }`}
        />
      ))}
    </div>
  );

  return (
    <div
      onClick={onStart}
      role="button"
      className="relative flex min-h-screen w-full cursor-pointer select-none flex-col items-center justify-between overflow-hidden bg-white py-10"
    >
      {strip(top, false)}
      <div className="flex flex-1 flex-col items-center justify-center gap-4 px-8 py-6 text-center">
        {menu.venue.logo && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={menu.venue.logo} alt={menu.venue.name} className="mb-2 h-28 w-28 rounded-[2rem] object-cover shadow-[var(--shadow-card)]" />
        )}
        <h1 className="font-display text-4xl font-extrabold tracking-tight text-ink">{menu.venue.name}</h1>
        <p className="text-sm font-bold uppercase tracking-[0.3em] text-muted">{t('attractSubtitle')}</p>
        <span
          className="mt-6 inline-block rounded-full px-12 py-5 text-2xl font-extrabold shadow-lg transition active:scale-95"
          style={{ background: brand, color: '#ffffff' }}
        >
          {t('startOrdering')}
        </span>
        <p className="mt-2 animate-pulse text-sm font-medium text-muted">{t('tapToStart')}</p>
      </div>
      {strip(bottom, true)}
    </div>
  );
}

/** Kiosk gözat/landing (dikey ekran) — selamlama + hero + öne çıkanlar + kategoriler. */
function KioskMenu({
  menu,
  tableCode,
  onEnter,
  onStartOver,
}: {
  menu: Menu;
  tableCode?: string;
  onEnter: () => void;
  onStartOver: () => void;
}) {
  const t = useTranslations('kiosk');
  const accent = accentOf(menu.venue);
  const cats = useMemo(() => menu.categories.filter((c) => c.products.length > 0), [menu]);
  const featured = useMemo(() => cats.flatMap((c) => c.products).filter((p) => p.images?.[0]).slice(0, 10), [cats]);
  const fmt = useMemo(
    () => new Intl.NumberFormat(menu.venue.locale_default ?? 'tr', { style: 'currency', currency: menu.venue.currency || 'TRY', maximumFractionDigits: 0 }),
    [menu.venue],
  );

  return (
    <div className="flex min-h-screen flex-col bg-canvas">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 bg-white px-6 py-5 shadow-sm">
        <div className="flex min-w-0 items-center gap-3">
          {menu.venue.logo && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={menu.venue.logo} alt={menu.venue.name} className="h-12 w-12 shrink-0 rounded-2xl object-cover" />
          )}
          <div className="min-w-0">
            <h1 className="truncate font-display text-2xl font-extrabold text-ink">{menu.venue.name}</h1>
            <p className="truncate text-sm text-muted">{t('greeting')}</p>
          </div>
        </div>
        <span className="shrink-0 rounded-xl px-4 py-2 text-sm font-bold" style={{ background: accent, color: '#ffffff' }}>
          {tableCode ?? t('dineIn')}
        </span>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto px-6 pb-28 pt-5">
        {/* Hero */}
        <button
          onClick={onEnter}
          className="mb-7 block w-full overflow-hidden rounded-3xl p-7 text-left text-white shadow-[var(--shadow-card)]"
          style={{ background: `linear-gradient(120deg, ${accent}, ${accent}cc)` }}
        >
          <p className="text-xs font-bold uppercase tracking-[0.2em]" style={{ color: '#ffffff', opacity: 0.9 }}>
            {t('heroKicker')}
          </p>
          <h2 className="mt-2 font-display text-3xl font-extrabold" style={{ color: '#ffffff' }}>
            {menu.venue.name}
          </h2>
          <p className="mt-1 text-base" style={{ color: '#ffffff', opacity: 0.9 }}>
            {menu.venue.sub_title || t('heroSub')}
          </p>
          <span className="mt-5 inline-block rounded-full bg-white px-6 py-3 text-base font-bold" style={{ color: accent }}>
            {t('browseMenu')} →
          </span>
        </button>

        {/* Featured */}
        {featured.length > 0 && (
          <>
            <h3 className="mb-3 font-display text-xl font-extrabold text-ink">{t('featured')}</h3>
            <div className="mb-8 flex gap-4 overflow-x-auto pb-2">
              {featured.map((p) => (
                <button
                  key={p.id}
                  onClick={onEnter}
                  className="w-44 shrink-0 overflow-hidden rounded-2xl bg-white text-left shadow-[var(--shadow-card)] transition active:scale-95"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p.images[0]} alt={p.name} className="h-32 w-full bg-canvas object-cover" />
                  <div className="p-3">
                    <p className="line-clamp-2 text-sm font-semibold text-ink">{p.name}</p>
                    <p className="mt-1 text-base font-extrabold" style={{ color: accent }}>
                      {fmt.format(Number(p.price))}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          </>
        )}

        {/* Categories */}
        <h3 className="mb-3 font-display text-xl font-extrabold text-ink">{t('selectCategory')}</h3>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
          {cats.map((c) => (
            <button
              key={c.id}
              onClick={onEnter}
              className="flex flex-col items-center gap-3 rounded-3xl bg-white p-5 shadow-[var(--shadow-card)] transition active:scale-95"
            >
              <div className="h-24 w-24 overflow-hidden rounded-full bg-canvas ring-1 ring-black/5">
                {c.image_path ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={c.image_path} alt={c.name} className="h-full w-full object-cover" />
                ) : (
                  <div className="grid h-full w-full place-items-center text-3xl">🍽️</div>
                )}
              </div>
              <span className="text-center text-base font-bold leading-tight text-ink">{c.name}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Bottom action bar */}
      <div className="fixed inset-x-0 bottom-0 z-20 flex gap-3 border-t border-line bg-white p-4">
        <button onClick={onStartOver} className="flex-1 rounded-2xl bg-red-500 py-4 text-base font-extrabold text-white transition active:scale-95" style={{ color: '#ffffff' }}>
          ↻ {t('startOver')}
        </button>
        <button onClick={onEnter} className="flex-1 rounded-2xl py-4 text-base font-extrabold transition active:scale-95" style={{ background: accent, color: '#ffffff' }}>
          🔍 {t('searchProduct')}
        </button>
      </div>
    </div>
  );
}
