'use client';

import { useMemo, useState } from 'react';
import { ApiClient } from '@comiqr/shared-types/client';
import type { AllergenRef, Menu, MenuProduct } from '@comiqr/shared-types';
import type { MenuLabels } from './menu';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://127.0.0.1:8000/v1';

interface CartLine {
  product: MenuProduct;
  qty: number;
}

export function OrderableMenu({
  menu,
  labels,
  qrToken,
  tableCode,
  strings,
}: {
  menu: Menu;
  labels: MenuLabels;
  qrToken: string;
  tableCode?: string;
  strings: {
    add: string;
    cart: string;
    placeOrder: string;
    placing: string;
    placed: string;
    orderStatus: string;
    empty: string;
    total: string;
    error: string;
  };
}) {
  const allergenMap = useMemo(
    () => new Map<number, AllergenRef>(menu.allergens.map((a) => [a.id, a])),
    [menu.allergens],
  );
  const format = useMemo(
    () =>
      new Intl.NumberFormat(menu.venue.locale_default ?? 'tr', {
        style: 'currency',
        currency: menu.venue.currency || 'TRY',
        maximumFractionDigits: 0,
      }),
    [menu.venue],
  );

  const [cart, setCart] = useState<Record<number, CartLine>>({});
  const [placing, setPlacing] = useState(false);
  const [placedOrder, setPlacedOrder] = useState<{ id: number; status: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const lines = Object.values(cart);
  const total = lines.reduce((sum, l) => sum + Number(l.product.price) * l.qty, 0);
  const count = lines.reduce((sum, l) => sum + l.qty, 0);

  function setQty(product: MenuProduct, qty: number) {
    setCart((c) => {
      const next = { ...c };
      if (qty <= 0) delete next[product.id];
      else next[product.id] = { product, qty };
      return next;
    });
  }

  async function placeOrder() {
    setPlacing(true);
    setError(null);
    try {
      const api = new ApiClient({ baseUrl: API_URL });
      const order = await api.request<{ id: number; status: string }>(
        `/sessions/${encodeURIComponent(qrToken)}/orders`,
        {
          method: 'POST',
          body: JSON.stringify({
            items: lines.map((l) => ({ product_id: l.product.id, quantity: l.qty })),
          }),
        },
      );
      setPlacedOrder(order);
      setCart({});
    } catch {
      setError(strings.error);
    } finally {
      setPlacing(false);
    }
  }

  const categories = menu.categories.filter((c) => c.products.length > 0);

  return (
    <div className="mx-auto max-w-2xl pb-28">
      <header className="sticky top-0 z-10 border-b bg-canvas/90 px-5 py-4 backdrop-blur">
        <div className="flex items-baseline justify-between gap-2">
          <h1 className="text-xl font-bold text-ink">{menu.venue.name}</h1>
          {tableCode && (
            <span className="rounded-full bg-brand-500 px-3 py-1 text-xs font-semibold text-white">
              {tableCode}
            </span>
          )}
        </div>
      </header>

      {placedOrder && (
        <div className="mx-5 mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          ✓ {strings.placed} · {strings.orderStatus}: <b>{placedOrder.status}</b> (#{placedOrder.id})
        </div>
      )}

      {categories.map((c) => (
        <section key={c.id} className="px-5 pt-6">
          <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-brand-600">{c.name}</h2>
          <div className="space-y-3">
            {c.products.map((p) => (
              <ProductRow
                key={p.id}
                product={p}
                qty={cart[p.id]?.qty ?? 0}
                onQty={(q) => setQty(p, q)}
                allergenMap={allergenMap}
                labels={labels}
                format={format}
                addLabel={strings.add}
              />
            ))}
          </div>
        </section>
      ))}

      {count > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-20 border-t bg-surface px-5 py-3 shadow-[0_-4px_16px_rgba(0,0,0,0.06)]">
          <div className="mx-auto flex max-w-2xl items-center justify-between gap-3">
            <div className="text-sm">
              <span className="text-muted">{strings.cart}:</span>{' '}
              <b className="text-ink">
                {count} · {format.format(total)}
              </b>
            </div>
            <button
              onClick={placeOrder}
              disabled={placing}
              className="rounded-lg bg-brand-500 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
            >
              {placing ? strings.placing : strings.placeOrder}
            </button>
          </div>
          {error && <p className="mx-auto mt-1 max-w-2xl text-xs text-red-600">{error}</p>}
        </div>
      )}
    </div>
  );
}

function ProductRow({
  product,
  qty,
  onQty,
  allergenMap,
  labels,
  format,
  addLabel,
}: {
  product: MenuProduct;
  qty: number;
  onQty: (q: number) => void;
  allergenMap: Map<number, AllergenRef>;
  labels: MenuLabels;
  format: Intl.NumberFormat;
  addLabel: string;
}) {
  const n = product.nutrition;
  const contains = (n?.allergens.contains ?? []).map((id) => allergenMap.get(id)?.name).filter(Boolean);

  return (
    <article className="rounded-2xl border bg-surface p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-semibold text-ink">{product.name}</h3>
          {product.description && <p className="mt-0.5 text-sm text-muted">{product.description}</p>}
          {n && (
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">
                {Math.round(n.kcal)} {labels.kcal}
              </span>
              {n.diet.vegan && <Badge label={labels.vegan} />}
              {!n.diet.vegan && n.diet.vegetarian && <Badge label={labels.vegetarian} />}
              {n.diet.gluten_free && <Badge label={labels.glutenFree} />}
            </div>
          )}
          {contains.length > 0 && (
            <p className="mt-1.5 text-xs text-muted">
              {labels.contains}: {contains.join(', ')}
            </p>
          )}
        </div>
        <div className="shrink-0 text-right">
          <div className="font-bold text-ink">{format.format(Number(product.price))}</div>
          <div className="mt-2">
            {qty === 0 ? (
              <button
                onClick={() => onQty(1)}
                className="rounded-lg border border-brand-500 px-3 py-1 text-sm font-semibold text-brand-600"
              >
                {addLabel}
              </button>
            ) : (
              <div className="inline-flex items-center gap-2 rounded-lg border">
                <Step onClick={() => onQty(qty - 1)}>−</Step>
                <span className="min-w-5 text-center text-sm font-semibold">{qty}</span>
                <Step onClick={() => onQty(qty + 1)}>+</Step>
              </div>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}

function Step({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button onClick={onClick} className="h-8 w-8 text-lg font-bold text-brand-600">
      {children}
    </button>
  );
}

function Badge({ label }: { label: string }) {
  return (
    <span className="rounded-md bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800">{label}</span>
  );
}
