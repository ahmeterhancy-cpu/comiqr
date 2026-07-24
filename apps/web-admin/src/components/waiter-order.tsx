'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Customizer, money } from '@/components/pos-kit';

type Line = {
  key: string;
  product: any;
  qty: number;
  variantId?: number;
  variantName?: string;
  modifierIds: number[];
  modifierNames: string[];
  unitPrice: number;
};

const lineKey = (pid: number, vid: number | undefined, mods: number[]) =>
  `${pid}:${vid ?? 0}:${[...mods].sort((a, b) => a - b).join(',')}`;

const STATUS_STYLE: Record<string, string> = {
  pending: 'bg-slate-100 text-slate-600',
  preparing: 'bg-amber-100 text-amber-700',
  ready: 'bg-emerald-100 text-emerald-700',
  served: 'bg-slate-100 text-slate-400',
  cancelled: 'bg-red-100 text-red-500 line-through',
};

/**
 * Waiter order screen (M10) — deliberately NOT the cashier POS. A waiter opens a
 * table from the floor board to: take an order (build a ticket → send to the
 * kitchen), view what the table has already ordered, and follow each item's
 * kitchen status (pending → preparing → ready → served). No payment, no receipt
 * printing, no discounts/refunds, no cash drawer — that stays in /pos (cashier).
 */
export function WaiterOrder({
  api,
  table,
  currency,
  onBack,
  onChanged,
}: {
  api: any;
  table: { id: number; code: string };
  currency: string;
  onBack: () => void;
  onChanged?: () => void;
}) {
  const t = useTranslations('waiter');
  const [products, setProducts] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [order, setOrder] = useState<any | null>(null);
  const [activeCat, setActiveCat] = useState<number | null>(null);
  const [search, setSearch] = useState('');
  const [cart, setCart] = useState<Record<string, Line>>({});
  const [customizing, setCustomizing] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [serving, setServing] = useState<number | null>(null);
  const [err, setErr] = useState<string | null>(null);

  // The table's current open order — matched by code from the open-tabs list.
  const loadOrder = useCallback(async () => {
    const orders = await api.posOrders({ scope: 'open' }).catch(() => [] as any[]);
    setOrder(orders.find((o: any) => o.table_code === table.code) ?? null);
  }, [api, table.code]);

  useEffect(() => {
    let alive = true;
    (async () => {
      const [ps, cs] = await Promise.all([
        api.adminProducts().catch(() => [] as any[]),
        api.adminCategories().catch(() => [] as any[]),
      ]);
      if (!alive) return;
      setProducts(ps.filter((p: any) => p.is_active));
      setCategories(cs);
      await loadOrder();
      setLoading(false);
    })();
    // Poll so the kitchen status of already-sent items stays live on this screen.
    const id = setInterval(loadOrder, 5000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [api, loadOrder]);

  const shown = useMemo(() => {
    const q = search.trim().toLocaleLowerCase('tr');
    return products.filter(
      (p) => (activeCat ? p.category_id === activeCat : true) && (q ? p.name.toLocaleLowerCase('tr').includes(q) : true),
    );
  }, [products, activeCat, search]);

  function pick(product: any) {
    const hasOptions = (product.variants?.length ?? 0) > 0 || (product.modifier_groups?.length ?? 0) > 0;
    if (hasOptions) setCustomizing(product);
    else addLine(product, undefined, [], []);
  }

  function addLine(product: any, variant: any, modifierIds: number[], modifierNames: string[]) {
    const modSum = (product.modifier_groups ?? [])
      .flatMap((g: any) => g.modifiers)
      .filter((m: any) => modifierIds.includes(m.id))
      .reduce((s: number, m: any) => s + Number(m.price_delta), 0);
    const unitPrice = Number(product.price) + Number(variant?.price_delta ?? 0) + modSum;
    const key = lineKey(product.id, variant?.id, modifierIds);
    setCart((c) => {
      const cur = c[key];
      return {
        ...c,
        [key]: cur
          ? { ...cur, qty: cur.qty + 1 }
          : { key, product, qty: 1, variantId: variant?.id, variantName: variant?.name, modifierIds, modifierNames, unitPrice },
      };
    });
  }

  function setQty(key: string, qty: number) {
    setCart((c) => {
      const n = { ...c };
      if (qty <= 0) delete n[key];
      else n[key] = { ...n[key], qty };
      return n;
    });
  }

  const cartLines = Object.values(cart);
  const cartCount = cartLines.reduce((s, l) => s + l.qty, 0);
  const cartTotal = cartLines.reduce((s, l) => s + l.unitPrice * l.qty, 0);
  const committed = (order?.items ?? []).filter((i: any) => i.status !== 'cancelled');

  async function send() {
    if (cartLines.length === 0) return;
    setBusy(true);
    setErr(null);
    const items = cartLines.map((l) => ({
      product_id: l.product.id,
      variant_id: l.variantId,
      quantity: l.qty,
      modifiers: l.modifierIds,
    }));
    try {
      if (order) await api.posAddItems(order.id, items);
      else await api.posOrder({ table_id: table.id, items });
      setCart({});
      await loadOrder();
      onChanged?.();
    } catch {
      setErr(t('sendError'));
    } finally {
      setBusy(false);
    }
  }

  async function serve(itemId: number) {
    setServing(itemId);
    try {
      await api.waiterServed(itemId);
      await loadOrder();
      onChanged?.();
    } finally {
      setServing(null);
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      {/* Header */}
      <header className="sticky top-0 z-20 flex items-center gap-2 border-b border-line bg-white px-3 py-3 shadow-sm">
        <button
          type="button"
          onClick={onBack}
          className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-muted transition hover:bg-slate-100 hover:text-ink"
          aria-label={t('back')}
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
        </button>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold text-ink">{table.code}</p>
          <p className="text-[11px] text-muted">{t('takeOrder')}</p>
        </div>
      </header>

      <main className="mx-auto w-full max-w-md flex-1 px-3 pb-40 pt-3">
        {/* Current table order + live kitchen status */}
        <section className="mb-4">
          <h2 className="mb-2 text-[13px] font-bold uppercase tracking-wide text-muted">{t('currentOrder')}</h2>
          {loading ? (
            <p className="py-4 text-center text-sm text-muted">{t('loading')}</p>
          ) : committed.length === 0 ? (
            <p className="rounded-xl border border-dashed border-line bg-white py-5 text-center text-sm text-muted">{t('noOrderYet')}</p>
          ) : (
            <div className="space-y-2">
              {committed.map((i: any) => (
                <div key={i.id} className="flex items-center gap-3 rounded-xl border border-line bg-white px-3 py-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-ink">
                      {i.quantity}× {i.product_name ?? t('item')}
                    </p>
                    {(i.modifiers ?? []).length > 0 && (
                      <p className="truncate text-[11px] text-muted">{i.modifiers.map((m: any) => m.name).join(' · ')}</p>
                    )}
                  </div>
                  {i.status === 'ready' ? (
                    <button
                      type="button"
                      onClick={() => serve(i.id)}
                      disabled={serving === i.id}
                      className="shrink-0 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white transition active:scale-95 disabled:opacity-50"
                      style={{ color: '#ffffff' }}
                    >
                      {t('serve')}
                    </button>
                  ) : (
                    <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold ${STATUS_STYLE[i.status] ?? 'bg-slate-100 text-slate-600'}`}>
                      {t(`status${i.status.charAt(0).toUpperCase()}${i.status.slice(1)}` as any)}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Product picker */}
        <section>
          <h2 className="mb-2 text-[13px] font-bold uppercase tracking-wide text-muted">{t('addProducts')}</h2>
          <div className="relative mb-2">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted">🔍</span>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('searchProduct')}
              className="w-full rounded-lg border border-line bg-white py-2.5 pl-9 pr-3 text-sm outline-none focus:border-brand-500"
            />
          </div>
          <div className="-mx-3 mb-3 flex gap-2 overflow-x-auto px-3 pb-1">
            <Chip active={activeCat === null} onClick={() => setActiveCat(null)}>{t('all')}</Chip>
            {categories.map((c) => (
              <Chip key={c.id} active={activeCat === c.id} onClick={() => setActiveCat(c.id)}>{c.name}</Chip>
            ))}
          </div>
          {shown.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted">{t('noProducts')}</p>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {shown.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => pick(p)}
                  className="flex flex-col rounded-xl border border-line bg-white p-3 text-left transition active:scale-[0.98]"
                >
                  <span className="line-clamp-2 text-sm font-semibold leading-tight text-ink">{p.name}</span>
                  <span className="mt-auto flex items-center justify-between pt-2">
                    <span className="text-sm font-bold text-brand-600">{money(p.price, currency)}</span>
                    <span className="grid h-7 w-7 place-items-center rounded-full bg-brand-500 text-base font-bold leading-none text-white" style={{ color: '#ffffff' }}>＋</span>
                  </span>
                </button>
              ))}
            </div>
          )}
        </section>
      </main>

      {/* Cart / send bar — only when there are new items to send */}
      {cartLines.length > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-white shadow-[0_-4px_16px_rgba(0,0,0,0.06)]">
          <div className="mx-auto w-full max-w-md px-3 pb-3 pt-2">
            <div className="mb-1 flex items-center justify-between">
              <span className="text-[12px] font-bold uppercase tracking-wide text-muted">{t('newItems')}</span>
              <span className="text-xs text-muted">{t('itemsCount', { count: cartCount })}</span>
            </div>
            <div className="max-h-[34vh] space-y-1.5 overflow-y-auto py-1">
              {cartLines.map((l) => (
                <div key={l.key} className="flex items-center gap-2 rounded-lg border border-brand-100 bg-brand-50/40 px-2.5 py-2">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-ink">{l.product.name}</p>
                    {(l.variantName || l.modifierNames.length > 0) && (
                      <p className="truncate text-[11px] text-muted">{[l.variantName, ...l.modifierNames].filter(Boolean).join(' · ')}</p>
                    )}
                    <p className="text-[11px] text-brand-600">{money(l.unitPrice * l.qty, currency)}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    <button type="button" onClick={() => setQty(l.key, l.qty - 1)} className="grid h-7 w-7 place-items-center rounded-md border border-line bg-white text-ink">−</button>
                    <span className="w-5 text-center text-sm font-bold text-ink">{l.qty}</span>
                    <button type="button" onClick={() => setQty(l.key, l.qty + 1)} className="grid h-7 w-7 place-items-center rounded-md border border-line bg-white text-ink">+</button>
                  </div>
                </div>
              ))}
            </div>
            {err && <p className="mb-1 text-xs text-red-600">{err}</p>}
            <button
              type="button"
              onClick={send}
              disabled={busy}
              className="mt-1.5 flex w-full items-center justify-center gap-2 rounded-xl bg-brand-500 py-3.5 text-sm font-bold text-white transition active:scale-[0.99] disabled:opacity-50"
              style={{ color: '#ffffff' }}
            >
              🍳 {busy ? t('sending') : t('sendToKitchen')} · {money(cartTotal, currency)}
            </button>
          </div>
        </div>
      )}

      {customizing && (
        <Customizer
          product={customizing}
          currency={currency}
          onClose={() => setCustomizing(null)}
          onAdd={(variant, ids, names) => {
            addLine(customizing, variant, ids, names);
            setCustomizing(null);
          }}
        />
      )}
    </div>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`shrink-0 whitespace-nowrap rounded-full px-3.5 py-1.5 text-sm font-semibold transition ${
        active ? 'bg-brand-500 text-white' : 'border border-line bg-white text-muted'
      }`}
      style={active ? { color: '#ffffff' } : undefined}
    >
      {children}
    </button>
  );
}
