'use client';

import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { OrderableMenu } from '@/components/orderable-menu';
import type { Menu } from '@comiqr/shared-types';

/**
 * Self-service kiosk (M16) — a stationary tablet at the venue. Shows a branded
 * attract/welcome screen ("Siparişe Başla"); tapping it reveals the full ordering
 * flow (OrderableMenu). The kiosk top bar's "new order" reloads to a clean cart —
 * which returns to the attract screen — for the next guest.
 */
export function KioskFrame({ menu, qrToken, tableCode }: { menu: Menu; qrToken: string; tableCode?: string }) {
  const t = useTranslations('kiosk');
  const [started, setStarted] = useState(false);

  if (!started) return <KioskAttract menu={menu} onStart={() => setStarted(true)} />;

  return (
    <div className="min-h-screen bg-canvas">
      <div className="sticky top-0 z-30 flex items-center justify-between border-b border-line bg-[color:var(--color-navy)] px-6 py-3 text-white">
        <span className="font-display text-lg font-semibold" style={{ color: '#ffffff' }}>
          {t('title')}
        </span>
        <button
          onClick={() => window.location.reload()}
          className="rounded-full bg-white/15 px-4 py-1.5 text-sm font-semibold backdrop-blur transition hover:bg-white/25"
          style={{ color: '#ffffff' }}
        >
          {t('newOrder')}
        </button>
      </div>
      <OrderableMenu menu={menu} qrToken={qrToken} tableCode={tableCode} />
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
  const brand = /^#[0-9a-fA-F]{6}$/.test(menu.venue.brand_color ?? '') ? (menu.venue.brand_color as string) : 'var(--color-navy)';
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
          <img
            src={menu.venue.logo}
            alt={menu.venue.name}
            className="mb-2 h-28 w-28 rounded-[2rem] object-cover shadow-[var(--shadow-card)]"
          />
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
