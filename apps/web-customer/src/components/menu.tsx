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

export function MenuView({
  menu,
  labels,
  tableCode,
}: {
  menu: Menu;
  labels: MenuLabels;
  tableCode?: string;
}) {
  const allergenMap = new Map<number, AllergenRef>(menu.allergens.map((a) => [a.id, a]));
  const format = new Intl.NumberFormat(menu.venue.locale_default ?? 'tr', {
    style: 'currency',
    currency: menu.venue.currency || 'TRY',
    maximumFractionDigits: 0,
  });

  const categories = menu.categories.filter((c) => c.products.length > 0);

  return (
    <div className="mx-auto max-w-2xl pb-16">
      <header className="sticky top-0 z-10 border-b bg-canvas/90 px-5 py-4 backdrop-blur">
        <div className="flex items-baseline justify-between gap-2">
          <h1 className="text-xl font-bold text-ink">{menu.venue.name}</h1>
          {tableCode && (
            <span className="rounded-full bg-brand-500 px-3 py-1 text-xs font-semibold text-white">
              {tableCode}
            </span>
          )}
        </div>
        {categories.length > 1 && (
          <nav className="mt-3 flex gap-2 overflow-x-auto pb-1">
            {categories.map((c) => (
              <a
                key={c.id}
                href={`#cat-${c.id}`}
                className="whitespace-nowrap rounded-full border bg-white px-3 py-1 text-xs font-medium text-muted"
              >
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
          <CategorySection
            key={c.id}
            category={c}
            allergenMap={allergenMap}
            labels={labels}
            format={format}
          />
        ))
      )}
    </div>
  );
}

function CategorySection({
  category,
  allergenMap,
  labels,
  format,
}: {
  category: MenuCategory;
  allergenMap: Map<number, AllergenRef>;
  labels: MenuLabels;
  format: Intl.NumberFormat;
}) {
  return (
    <section id={`cat-${category.id}`} className="scroll-mt-24 px-5 pt-6">
      <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-brand-600">{category.name}</h2>
      <div className="space-y-3">
        {category.products.map((p) => (
          <ProductCard key={p.id} product={p} allergenMap={allergenMap} labels={labels} format={format} />
        ))}
      </div>
    </section>
  );
}

function ProductCard({
  product,
  allergenMap,
  labels,
  format,
}: {
  product: MenuProduct;
  allergenMap: Map<number, AllergenRef>;
  labels: MenuLabels;
  format: Intl.NumberFormat;
}) {
  const n = product.nutrition;
  const contains = (n?.allergens.contains ?? []).map((id) => allergenMap.get(id)?.name).filter(Boolean);
  const traces = (n?.allergens.traces ?? []).map((id) => allergenMap.get(id)?.name).filter(Boolean);

  return (
    <article className="rounded-2xl border bg-surface p-4 shadow-sm">
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
        <div className="mt-3 border-t pt-3">
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
          {traces.length > 0 && (
            <p className="mt-0.5 text-xs text-muted/80">
              {labels.traces}: {traces.join(', ')}
            </p>
          )}
        </div>
      )}
    </article>
  );
}

function Macro({ label, value }: { label: string; value: number }) {
  return (
    <span className="rounded-md bg-canvas px-2 py-0.5 text-xs text-ink/70">
      {label} <b className="text-ink">{Math.round(value)}g</b>
    </span>
  );
}

function Diet({ label }: { label: string }) {
  return (
    <span className="rounded-md bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800">{label}</span>
  );
}
