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
  return (
    <div className="mx-auto max-w-2xl pb-16">
      <header className="sticky top-0 z-10 border-b border-line bg-canvas/90 px-5 py-4 backdrop-blur">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-3">
            {menu.venue.logo && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={menu.venue.logo} alt={menu.venue.name} className="h-10 w-10 rounded-lg object-cover" />
            )}
            <div>
              <h1 className="text-xl font-bold text-ink">{menu.venue.name}</h1>
              {menu.venue.sub_title && <p className="text-xs text-muted">{menu.venue.sub_title}</p>}
            </div>
          </div>
          {tableCode && (
            <span className="rounded-full bg-brand-500 px-3 py-1 text-xs font-semibold text-white">{tableCode}</span>
          )}
        </div>
        {categories.length > 1 && (
          <nav className="mt-3 flex gap-2 overflow-x-auto pb-1">
            {categories.map((c) => (
              <a key={c.id} href={`#cat-${c.id}`} className="whitespace-nowrap rounded-full border border-line bg-white px-3 py-1 text-xs font-medium text-muted">
                {c.name}
              </a>
            ))}
          </nav>
        )}
      </header>

      {categories.length === 0 ? (
        <p className="px-5 py-16 text-center text-sm text-muted">{labels.empty}</p>
      ) : (
        categories.map((c) => (
          <section key={c.id} id={`cat-${c.id}`} className="scroll-mt-24 px-5 pt-6">
            <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-brand-600">{c.name}</h2>
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
  const contains = (n?.allergens.contains ?? []).map((id) => allergenMap.get(id)?.name).filter(Boolean);
  const traces = (n?.allergens.traces ?? []).map((id) => allergenMap.get(id)?.name).filter(Boolean);

  return (
    <article className="rounded-2xl border border-line bg-surface p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-semibold text-ink">{product.name}</h3>
          {product.description && <p className="mt-0.5 text-sm text-muted">{product.description}</p>}
        </div>
        <div className="shrink-0 text-right">
          <div className="font-bold text-ink">{format.format(Number(product.price))}</div>
          {n && (
            <span className="mt-1 inline-block rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">
              {Math.round(n.kcal)} {labels.kcal}
            </span>
          )}
        </div>
      </div>
      {n && (
        <div className="mt-3 border-t border-line pt-3">
          <div className="flex flex-wrap items-center gap-1.5">
            <Macro label={labels.protein} value={n.macros.protein_g} />
            <Macro label={labels.carb} value={n.macros.carb_g} />
            <Macro label={labels.fat} value={n.macros.fat_g} />
            {n.diet.vegan && <Diet label={labels.vegan} />}
            {!n.diet.vegan && n.diet.vegetarian && <Diet label={labels.vegetarian} />}
            {n.diet.gluten_free && <Diet label={labels.glutenFree} />}
          </div>
          {contains.length > 0 && (
            <p className="mt-2 text-xs text-muted">
              <span className="font-medium text-ink/70">{labels.contains}:</span> {contains.join(', ')}
            </p>
          )}
          {traces.length > 0 && <p className="mt-0.5 text-xs text-muted/80">{labels.traces}: {traces.join(', ')}</p>}
        </div>
      )}
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

function Macro({ label, value }: { label: string; value: number }) {
  return (
    <span className="rounded-md bg-canvas px-2 py-0.5 text-xs text-ink/70">
      {label} <b className="text-ink">{Math.round(value)}g</b>
    </span>
  );
}

function Diet({ label }: { label: string }) {
  return <span className="rounded-md bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800">{label}</span>;
}
