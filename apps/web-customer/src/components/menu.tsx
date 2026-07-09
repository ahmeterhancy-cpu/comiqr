'use client';

import { useMemo, useState } from 'react';
import type { AllergenRef, Menu, MenuCategory, MenuProduct } from '@comiqr/shared-types';

export interface MenuLabels {
  kcal: string;
  protein: string;
  carb: string;
  fat: string;
  contains: string;
  traces: string;
  vegan: string;
  vegetarian: string;
  glutenFree: string;
  estimated: string;
  empty: string;
}

type ThemeProps = {
  menu: Menu;
  labels: MenuLabels;
  tableCode?: string;
  allergenMap: Map<number, AllergenRef>;
  format: Intl.NumberFormat;
  categories: MenuCategory[];
};

/** Public venue menu. The venue's chosen theme picks one of three layouts. */
export function MenuView({ menu, labels, tableCode }: { menu: Menu; labels: MenuLabels; tableCode?: string }) {
  const allergenMap = new Map<number, AllergenRef>(menu.allergens.map((a) => [a.id, a]));
  const format = new Intl.NumberFormat(menu.venue.locale_default ?? 'tr', {
    style: 'currency',
    currency: menu.venue.currency || 'TRY',
    maximumFractionDigits: 0,
  });
  const categories = menu.categories.filter((c) => c.products.length > 0);
  const props: ThemeProps = { menu, labels, tableCode, allergenMap, format, categories };

  const theme = menu.venue.theme ?? 'modern';
  if (theme === 'classic') return <ClassicMenu {...props} />;
  if (theme === 'flipbook') return <FlipbookMenu {...props} />;
  return <ModernMenu {...props} />;
}

/* ------------------------------------------------------------------ Modern */
/* Card list with full nutrition + a sticky category nav (the default). */

function ModernMenu({ menu, labels, tableCode, allergenMap, format, categories }: ThemeProps) {
  const v = menu.venue;
  const loc = v.locale_default ?? 'tr';
  const [search, setSearch] = useState('');
  const [fAllergen, setFAllergen] = useState(false);
  const [fGluten, setFGluten] = useState(false);
  const [fLactose, setFLactose] = useState(false);

  const glutenId = useMemo(() => menu.allergens.find((a) => /glu/i.test(a.code) || /gluten/i.test(a.name))?.id ?? null, [menu.allergens]);
  const lactoseId = useMemo(
    () => menu.allergens.find((a) => /lac|milk|dairy|sut/i.test(a.code) || /lakto|süt/i.test(a.name))?.id ?? null,
    [menu.allergens],
  );

  const visible = useMemo(() => {
    const q = search.trim().toLocaleLowerCase(loc);
    if (!q && !fAllergen && !fGluten && !fLactose) return categories;
    return categories
      .map((c) => ({
        ...c,
        products: c.products.filter((p) => {
          if (q && !p.name.toLocaleLowerCase(loc).includes(q) && !(p.description ?? '').toLocaleLowerCase(loc).includes(q)) return false;
          const contains = p.nutrition?.allergens?.contains ?? [];
          if (fAllergen && contains.length > 0) return false;
          if (fGluten && glutenId != null && contains.includes(glutenId)) return false;
          if (fLactose && lactoseId != null && contains.includes(lactoseId)) return false;
          return true;
        }),
      }))
      .filter((c) => c.products.length > 0);
  }, [categories, search, fAllergen, fGluten, fLactose, glutenId, lactoseId, loc]);

  return (
    <div className="mx-auto max-w-2xl pb-16">
      {/* Nameless-style light header */}
      <header className="bg-gradient-to-b from-brand-50/70 to-canvas px-5 pb-5 pt-8 text-center">
        {v.logo && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={v.logo} alt={v.name} className="mx-auto mb-3 h-16 w-16 rounded-2xl object-cover shadow-[var(--shadow-card)]" />
        )}
        <h1 className="text-2xl font-extrabold tracking-tight text-ink">{v.name}</h1>
        {v.sub_title && <p className="mt-0.5 text-sm text-muted">{v.sub_title}</p>}
        <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
          {v.timing && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-700">
              <span className="h-1.5 w-1.5 rounded-full bg-brand-500 ring-2 ring-brand-100" />
              Açık · {v.timing}
            </span>
          )}
          {v.address && <span className="rounded-full bg-white px-3 py-1 text-xs text-muted shadow-[var(--shadow-card)]">📍 {v.address}</span>}
          {tableCode && <span className="rounded-full bg-brand-500 px-3 py-1 text-xs font-semibold text-white">{tableCode}</span>}
        </div>
      </header>

      {/* Category image cards */}
      {categories.length > 1 && (
        <div className="no-scrollbar flex gap-3 overflow-x-auto px-4 pt-4">
          {categories.map((c) => {
            const img = c.image_path || c.products?.[0]?.images?.[0];
            return (
              <a
                key={c.id}
                href={`#cat-${c.id}`}
                className="relative aspect-[5/4] w-36 shrink-0 overflow-hidden rounded-2xl shadow-[var(--shadow-card)]"
              >
                {img ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={img} alt={c.name} className="absolute inset-0 h-full w-full object-cover" />
                ) : (
                  <div className="absolute inset-0 bg-gradient-to-br from-brand-500 to-brand-700" />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/25 to-transparent" />
                <span className="absolute inset-0 flex items-center justify-center px-2 text-center text-lg font-extrabold leading-tight text-white [text-shadow:0_2px_10px_rgba(0,0,0,0.55)]">
                  {c.name}
                </span>
              </a>
            );
          })}
        </div>
      )}

      {/* Search + allergen filters */}
      <div className="flex flex-col gap-2 px-4 pb-1 pt-3 sm:flex-row sm:items-center">
        <div className="flex flex-1 items-center gap-2 rounded-xl border border-line bg-white px-3.5 py-2.5">
          <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0 text-muted" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3-3" strokeLinecap="round" />
          </svg>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search..."
            className="w-full bg-transparent text-sm text-ink outline-none placeholder:text-muted"
          />
          {search && (
            <button onClick={() => setSearch('')} aria-label="Temizle" className="shrink-0 text-muted transition hover:text-ink">
              ✕
            </button>
          )}
        </div>
        <div className="no-scrollbar flex items-center gap-2 overflow-x-auto">
          <FilterChip active={fAllergen} onClick={() => setFAllergen((x) => !x)} tone="red">⚠️ Allergen</FilterChip>
          <FilterChip active={fGluten} onClick={() => setFGluten((x) => !x)} tone="amber">🌾 Gluten</FilterChip>
          <FilterChip active={fLactose} onClick={() => setFLactose((x) => !x)} tone="sky">🥛 Lactose</FilterChip>
        </div>
      </div>

      {visible.length === 0 ? (
        <p className="px-5 py-16 text-center text-sm text-muted">
          {search ? `“${search}” için sonuç bulunamadı.` : labels.empty}
        </p>
      ) : (
        visible.map((c) => (
          <section key={c.id} id={`cat-${c.id}`} className="scroll-mt-16 px-4 pt-6">
            <h2 className="mb-3 px-1 text-[13px] font-bold uppercase tracking-wider text-brand-700">{c.name}</h2>
            <div className="space-y-3">
              {c.products.map((p) => (
                <ModernProduct key={p.id} product={p} allergenMap={allergenMap} labels={labels} format={format} />
              ))}
            </div>
          </section>
        ))
      )}
    </div>
  );
}

function ModernProduct({ product, allergenMap, labels, format }: { product: MenuProduct; allergenMap: Map<number, AllergenRef>; labels: MenuLabels; format: Intl.NumberFormat }) {
  const n = product.nutrition;
  const img = product.images?.[0];
  const contains = (n?.allergens.contains ?? []).map((id) => allergenMap.get(id)?.name).filter(Boolean);

  return (
    <article className="flex gap-3.5 overflow-hidden rounded-2xl border border-line bg-surface p-3 shadow-[var(--shadow-card)]">
      {img && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={img} alt={product.name} className="h-24 w-24 shrink-0 rounded-xl object-cover" />
      )}
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-bold text-ink">
            {product.name}
            {product.age_restricted && (
              <span className="ml-1.5 rounded border border-red-500 px-1 text-[10px] font-bold text-red-600 align-middle">18+</span>
            )}
          </h3>
          <div className="shrink-0 font-extrabold text-ink">{format.format(Number(product.price))}</div>
        </div>
        {product.description && <p className="mt-0.5 line-clamp-2 text-[13px] leading-snug text-muted">{product.description}</p>}
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {n && (
            <span className="rounded-full bg-brand-50 px-2 py-0.5 text-[11px] font-semibold text-brand-700">
              {Math.round(n.kcal)} {labels.kcal}
            </span>
          )}
          {n?.diet.vegan && <Diet label={labels.vegan} />}
          {n && !n.diet.vegan && n.diet.vegetarian && <Diet label={labels.vegetarian} />}
          {n?.diet.gluten_free && <Diet label={labels.glutenFree} />}
          {contains.length > 0 && (
            <span className="text-[11px] text-muted">
              {labels.contains}: {contains.join(', ')}
            </span>
          )}
        </div>
      </div>
    </article>
  );
}

/* ----------------------------------------------------------------- Classic */
/* Image-forward: cover hero + logo + about, product photos in each card. */

function ClassicMenu({ menu, labels, format, categories }: ThemeProps) {
  const v = menu.venue;
  return (
    <div className="mx-auto max-w-2xl pb-16">
      <header className="relative overflow-hidden">
        <div className="relative h-52 bg-brand-600">
          {v.cover && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={v.cover} alt="" className="h-full w-full object-cover" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-black/10" />
        </div>
        <div className="relative -mt-12 px-5">
          <div className="flex items-end gap-3">
            {v.logo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={v.logo} alt={v.name} className="h-20 w-20 rounded-2xl border-4 border-canvas object-cover shadow-lg" />
            ) : (
              <div className="grid h-20 w-20 place-items-center rounded-2xl border-4 border-canvas bg-brand-500 text-2xl font-bold text-white shadow-lg">
                {v.name.charAt(0)}
              </div>
            )}
            <div className="pb-1">
              <h1 className="font-display text-2xl font-semibold text-ink">{v.name}</h1>
              {v.sub_title && <p className="text-sm text-muted">{v.sub_title}</p>}
            </div>
          </div>
          {(v.timing || v.address) && (
            <p className="mt-3 text-xs text-muted">
              {v.timing && <span>🕒 {v.timing}</span>}
              {v.timing && v.address && <span> · </span>}
              {v.address && <span>📍 {v.address}</span>}
            </p>
          )}
          {v.description && <p className="mt-3 text-sm leading-relaxed text-ink/80">{v.description}</p>}
        </div>
      </header>

      {categories.length === 0 ? (
        <p className="px-5 py-16 text-center text-sm text-muted">{labels.empty}</p>
      ) : (
        categories.map((c) => (
          <section key={c.id} className="px-5 pt-8">
            <h2 className="mb-4 font-display text-xl font-semibold text-brand-700">{c.name}</h2>
            <div className="space-y-3.5">
              {c.products.map((p) => (
                <article key={p.id} className="flex gap-4 overflow-hidden rounded-2xl border border-line bg-surface shadow-sm">
                  {p.images?.[0] && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.images[0]} alt={p.name} className="h-28 w-28 shrink-0 object-cover" />
                  )}
                  <div className="min-w-0 flex-1 py-3 pr-4">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-display text-lg font-semibold text-ink">{p.name}</h3>
                      <span className="shrink-0 font-display font-semibold text-brand-600">{format.format(Number(p.price))}</span>
                    </div>
                    {p.description && <p className="mt-1 text-sm leading-relaxed text-muted">{p.description}</p>}
                    {p.nutrition && (
                      <span className="mt-2 inline-block rounded-full bg-amber-bg px-2.5 py-0.5 text-xs font-semibold text-[color:var(--color-amber)]">
                        {Math.round(p.nutrition.kcal)} {labels.kcal}
                      </span>
                    )}
                  </div>
                </article>
              ))}
            </div>
          </section>
        ))
      )}
    </div>
  );
}

/* ---------------------------------------------------------------- Flipbook */
/* Printed-menu / magazine look: centered serif, dotted price leaders, no photos. */

function FlipbookMenu({ menu, labels, format, categories }: ThemeProps) {
  const v = menu.venue;
  return (
    <div className="min-h-screen bg-[#faf6ef]">
      <div className="mx-auto max-w-2xl px-6 pb-20 pt-10">
        <header className="border-y-2 border-[#2b2620] py-6 text-center">
          {v.sub_title && <p className="text-[11px] uppercase tracking-[0.35em] text-[#8a7f6d]">{v.sub_title}</p>}
          <h1 className="mt-1 font-display text-4xl font-semibold uppercase tracking-wide text-[#2b2620]">{v.name}</h1>
          {v.timing && <p className="mt-2 text-xs italic text-[#8a7f6d]">{v.timing}</p>}
        </header>

        {categories.length === 0 ? (
          <p className="py-16 text-center text-sm text-[#8a7f6d]">{labels.empty}</p>
        ) : (
          categories.map((c) => (
            <section key={c.id} className="pt-10">
              <h2 className="mb-5 text-center font-display text-2xl font-semibold uppercase tracking-[0.2em] text-[#2b2620]">
                <span className="mx-3 inline-block align-middle">{c.name}</span>
              </h2>
              <div className="space-y-4">
                {c.products.map((p) => (
                  <div key={p.id}>
                    <div className="flex items-baseline gap-2">
                      <span className="font-display text-lg font-medium text-[#2b2620]">{p.name}</span>
                      <span className="mx-1 flex-1 translate-y-[-0.2em] border-b border-dotted border-[#b8ab93]" />
                      <span className="font-display text-lg font-semibold text-[#2b2620]">{format.format(Number(p.price))}</span>
                    </div>
                    {p.description && <p className="mt-0.5 max-w-[85%] text-sm italic leading-snug text-[#8a7f6d]">{p.description}</p>}
                    {p.nutrition && <span className="text-[11px] text-[#b8ab93]">{Math.round(p.nutrition.kcal)} {labels.kcal}</span>}
                  </div>
                ))}
              </div>
            </section>
          ))
        )}

        {v.address && <p className="mt-12 border-t border-[#b8ab93] pt-4 text-center text-xs text-[#8a7f6d]">📍 {v.address}</p>}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------- shared bits */

function Diet({ label }: { label: string }) {
  return <span className="rounded-md bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800">{label}</span>;
}

function FilterChip({ active, onClick, tone, children }: { active: boolean; onClick: () => void; tone: 'red' | 'amber' | 'sky'; children: React.ReactNode }) {
  const tones = {
    red: active ? 'border-red-300 bg-red-100 text-red-700' : 'border-red-200 bg-red-50 text-red-600',
    amber: active ? 'border-amber-400 bg-amber-200 text-amber-900' : 'border-amber-200 bg-amber-50 text-amber-700',
    sky: active ? 'border-sky-400 bg-sky-200 text-sky-900' : 'border-sky-200 bg-sky-50 text-sky-700',
  };
  return (
    <button
      onClick={onClick}
      className={`shrink-0 whitespace-nowrap rounded-lg border px-2.5 py-1 text-xs font-semibold transition ${tones[tone]}`}
    >
      {children}
    </button>
  );
}
