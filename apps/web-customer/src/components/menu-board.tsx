'use client';

import { useEffect, useMemo, useState } from 'react';
import type { Menu } from '@comiqr/shared-types';

const ROTATE_MS = 10_000;

/**
 * Digital menu board (M17) — full-screen signage for a TV/tablet at the venue.
 * Read-only; rotates through categories on a timer. Refined editorial dark
 * (warm near-black + terracotta + serif display), not a generic neon board.
 */
export function MenuBoard({ menu }: { menu: Menu }) {
  const categories = useMemo(() => menu.categories.filter((c) => c.products.length > 0), [menu.categories]);
  const [index, setIndex] = useState(0);
  const [now, setNow] = useState<string>('');

  const fmt = useMemo(
    () =>
      new Intl.NumberFormat(menu.venue.locale_default ?? 'tr', {
        style: 'currency',
        currency: menu.venue.currency || 'TRY',
        maximumFractionDigits: 0,
      }),
    [menu.venue],
  );

  useEffect(() => {
    if (categories.length <= 1) return;
    const id = setInterval(() => setIndex((i) => (i + 1) % categories.length), ROTATE_MS);
    return () => clearInterval(id);
  }, [categories.length]);

  useEffect(() => {
    const tick = () =>
      setNow(new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }));
    tick();
    const id = setInterval(tick, 30_000);
    return () => clearInterval(id);
  }, []);

  if (categories.length === 0) {
    return (
      <div className="grid min-h-screen place-items-center bg-[#1c1613] text-white/70">
        <span className="text-2xl" style={{ color: '#ffffff' }}>
          {menu.venue.name}
        </span>
      </div>
    );
  }

  const category = categories[Math.min(index, categories.length - 1)];

  return (
    <div className="flex min-h-screen flex-col bg-[#1c1613] px-[4vw] py-[3vh] text-white">
      {/* Header */}
      <header className="flex items-baseline justify-between border-b border-white/10 pb-[2vh]">
        <div>
          <p className="text-[1.1vw] font-medium uppercase tracking-[0.35em] text-[#e08a5b]">Menü</p>
          <h1 className="font-display text-[3.4vw] font-semibold leading-none" style={{ color: '#ffffff' }}>
            {menu.venue.name}
          </h1>
        </div>
        <span className="font-display text-[2vw] tabular-nums text-white/60">{now}</span>
      </header>

      {/* Current category */}
      <section className="flex flex-1 flex-col justify-center py-[2vh]">
        <h2 className="mb-[3vh] font-display text-[2.6vw] font-semibold text-[#e08a5b]">{category.name}</h2>
        <div className="grid grid-cols-2 gap-x-[5vw] gap-y-[2.2vh]">
          {category.products.map((p) => (
            <div key={p.id} className="flex items-baseline gap-3">
              <span className="font-display text-[1.7vw] font-medium" style={{ color: '#ffffff' }}>
                {p.name}
              </span>
              <span className="mx-2 flex-1 translate-y-[-0.3vw] border-b border-dotted border-white/20" />
              {p.nutrition && (
                <span className="text-[1vw] text-white/40">{Math.round(p.nutrition.kcal)} kcal</span>
              )}
              <span className="font-display text-[1.7vw] font-semibold tabular-nums text-[#e08a5b]">
                {fmt.format(Number(p.price))}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* Rotation dots */}
      {categories.length > 1 && (
        <footer className="flex items-center justify-center gap-2 pt-[2vh]">
          {categories.map((c, i) => (
            <span
              key={c.id}
              className={`h-[0.7vh] rounded-full transition-all ${
                i === index ? 'w-[3vw] bg-[#e08a5b]' : 'w-[0.7vh] bg-white/25'
              }`}
            />
          ))}
        </footer>
      )}
    </div>
  );
}
