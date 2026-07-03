'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { AdminShell } from '@/components/AdminShell';
import { Button, Card, Input } from '@/components/ui';
import { getActiveBranchId } from '@/lib/branch';
import { useApi } from '@/lib/useApi';

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

/** Staff POS (Faz 3): waiter/cashier builds an order and settles at the counter. */
export default function PosPage() {
  const { api, me, ready } = useApi();
  const currency = me?.tenant?.currency ?? 'TRY';
  const [products, setProducts] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [tables, setTables] = useState<any[]>([]);
  const [activeCat, setActiveCat] = useState<number | null>(null);
  const [cart, setCart] = useState<Record<string, Line>>({});
  const [tableId, setTableId] = useState<number | ''>('');
  const [note, setNote] = useState('');
  const [customizing, setCustomizing] = useState<any | null>(null);
  const [order, setOrder] = useState<any | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [ps, cs, ts] = await Promise.all([api.adminProducts(), api.adminCategories(), api.adminTables()]);
    setProducts(ps.filter((p: any) => p.is_active));
    setCategories(cs);
    setActiveCat(cs[0]?.id ?? null);
    setTables(ts);
  }, [api]);

  useEffect(() => {
    if (ready) load();
  }, [ready, load]);

  const shown = useMemo(
    () => products.filter((p) => (activeCat ? p.category_id === activeCat : true)),
    [products, activeCat],
  );
  const fmt = (n: number) => `${Number(n).toLocaleString('tr-TR')} ${currency}`;

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

  const lines = Object.values(cart);
  const total = lines.reduce((s, l) => s + l.unitPrice * l.qty, 0);

  async function sendToKitchen() {
    if (lines.length === 0) return;
    setBusy(true);
    setError(null);
    try {
      const res = await api.posOrder({
        table_id: tableId || undefined,
        branch_id: getActiveBranchId() ?? undefined,
        items: lines.map((l) => ({
          product_id: l.product.id,
          variant_id: l.variantId,
          quantity: l.qty,
          modifiers: l.modifierIds,
        })),
        note: note || undefined,
      });
      setOrder(res);
      setCart({});
      setNote('');
    } catch (e) {
      setError((e as { message?: string })?.message ?? 'Sipariş oluşturulamadı.');
    } finally {
      setBusy(false);
    }
  }

  async function pay(gateway: 'cash' | 'card') {
    if (!order) return;
    setBusy(true);
    try {
      await api.posPay(order.id, gateway);
      setOrder(null);
      setTableId('');
    } catch {
      setError('Tahsilat başarısız.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <AdminShell title="POS — Hızlı Satış">
      <div className="grid gap-5 lg:grid-cols-[1fr_22rem]">
        {/* Product picker */}
        <div>
          <div className="mb-3 flex flex-wrap gap-2">
            {categories.map((c) => (
              <button
                key={c.id}
                onClick={() => setActiveCat(c.id)}
                className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                  activeCat === c.id ? 'bg-brand-500 text-white' : 'border border-line bg-surface text-muted hover:border-brand-300'
                }`}
              >
                {c.name}
              </button>
            ))}
          </div>
          <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
            {shown.map((p) => (
              <button
                key={p.id}
                onClick={() => pick(p)}
                className="rounded-xl border border-line bg-surface p-3 text-left transition hover:border-brand-400 hover:shadow-sm"
              >
                <div className="text-sm font-semibold text-ink">{p.name}</div>
                <div className="mt-1 text-xs text-muted">{fmt(p.price)}</div>
                {(p.variants?.length > 0 || p.modifier_groups?.length > 0) && (
                  <div className="mt-1 text-[10px] text-brand-600">seçenekli</div>
                )}
              </button>
            ))}
            {shown.length === 0 && <p className="text-sm text-muted">Bu kategoride ürün yok.</p>}
          </div>
        </div>

        {/* Cart / checkout */}
        <Card className="lg:sticky lg:top-6 h-fit">
          {order ? (
            <div className="space-y-3">
              <p className="text-sm font-semibold text-ink">Sipariş #{order.id} oluşturuldu ✓</p>
              <p className="text-xs text-muted">Mutfağa gönderildi. Tutar: <b className="text-ink">{fmt(order.grand_total)}</b></p>
              <p className="text-xs font-medium text-muted">Kapıda tahsilat:</p>
              <div className="grid grid-cols-2 gap-2">
                <Button onClick={() => pay('cash')} disabled={busy}>💵 Nakit</Button>
                <Button onClick={() => pay('card')} disabled={busy}>💳 Kart</Button>
              </div>
              <button onClick={() => setOrder(null)} className="w-full text-xs text-muted hover:underline">
                Ödemeyi atla (sonra tahsil et)
              </button>
            </div>
          ) : (
            <>
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-ink">Sepet</h3>
                <select
                  value={tableId}
                  onChange={(e) => setTableId(e.target.value ? Number(e.target.value) : '')}
                  className="rounded-lg border border-line bg-white px-2 py-1 text-xs text-ink"
                >
                  <option value="">Gel-al</option>
                  {tables.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.code}
                    </option>
                  ))}
                </select>
              </div>

              {lines.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted">Ürün ekleyin…</p>
              ) : (
                <ul className="mb-3 max-h-72 space-y-2 overflow-y-auto">
                  {lines.map((l) => (
                    <li key={l.key} className="flex items-start justify-between gap-2 text-sm">
                      <div className="min-w-0">
                        <div className="text-ink">{l.product.name}</div>
                        {(l.variantName || l.modifierNames.length > 0) && (
                          <div className="text-[11px] text-muted">
                            {[l.variantName, ...l.modifierNames].filter(Boolean).join(' · ')}
                          </div>
                        )}
                      </div>
                      <div className="flex shrink-0 items-center gap-1.5">
                        <button onClick={() => setQty(l.key, l.qty - 1)} className="grid h-6 w-6 place-items-center rounded bg-canvas text-ink">−</button>
                        <span className="w-5 text-center font-semibold text-ink">{l.qty}</span>
                        <button onClick={() => setQty(l.key, l.qty + 1)} className="grid h-6 w-6 place-items-center rounded bg-canvas text-ink">+</button>
                        <span className="w-16 text-right text-xs font-medium text-ink">{fmt(l.unitPrice * l.qty)}</span>
                      </div>
                    </li>
                  ))}
                </ul>
              )}

              <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Not (opsiyonel)" className="mb-3" />
              <div className="mb-3 flex items-center justify-between text-sm">
                <span className="text-muted">Toplam</span>
                <span className="text-lg font-bold text-ink">{fmt(total)}</span>
              </div>
              {error && <p className="mb-2 text-xs text-red-600">{error}</p>}
              <Button onClick={sendToKitchen} disabled={busy || lines.length === 0} className="w-full">
                {busy ? 'Gönderiliyor…' : 'Mutfağa Gönder'}
              </Button>
            </>
          )}
        </Card>
      </div>

      {customizing && (
        <Customizer
          product={customizing}
          fmt={fmt}
          onClose={() => setCustomizing(null)}
          onAdd={(variant: any, ids: number[], names: string[]) => {
            addLine(customizing, variant, ids, names);
            setCustomizing(null);
          }}
        />
      )}
    </AdminShell>
  );
}

function Customizer({ product, fmt, onClose, onAdd }: any) {
  const variants = product.variants ?? [];
  const groups = product.modifier_groups ?? [];
  const [variantId, setVariantId] = useState<number | undefined>(
    variants.find((v: any) => v.is_default)?.id ?? variants[0]?.id,
  );
  const [selected, setSelected] = useState<Record<number, number[]>>({});

  const variant = variants.find((v: any) => v.id === variantId);
  const chosen = groups.flatMap((g: any) => (selected[g.id] ?? []).map((id: number) => g.modifiers.find((m: any) => m.id === id))).filter(Boolean);
  const modifierIds = chosen.map((m: any) => m.id);
  const modifierNames = chosen.map((m: any) => m.name);
  const missingRequired = groups.some((g: any) => {
    const min = g.is_required ? Math.max(1, g.min_select) : g.min_select;
    return (selected[g.id] ?? []).length < min;
  });

  function toggle(g: any, id: number) {
    setSelected((prev) => {
      const cur = prev[g.id] ?? [];
      let next: number[];
      if (g.max_select <= 1) next = cur.includes(id) ? (g.is_required ? cur : []) : [id];
      else if (cur.includes(id)) next = cur.filter((x) => x !== id);
      else if (cur.length < g.max_select) next = [...cur, id];
      else next = cur;
      return { ...prev, [g.id]: next };
    });
  }

  return (
    <div className="fixed inset-0 z-30 grid place-items-center bg-black/40 p-4" onClick={onClose}>
      <Card className="w-full max-w-md" >
        <div onClick={(e) => e.stopPropagation()}>
          <h3 className="text-base font-semibold text-ink">{product.name}</h3>
          {variants.length > 0 && (
            <div className="mt-3">
              <p className="mb-1.5 text-xs font-semibold text-muted">Boyut</p>
              <div className="flex flex-wrap gap-1.5">
                {variants.map((v: any) => (
                  <button
                    key={v.id}
                    onClick={() => setVariantId(v.id)}
                    className={`rounded-full px-3 py-1 text-xs font-medium ${v.id === variantId ? 'bg-brand-500 text-white' : 'border border-line text-muted'}`}
                  >
                    {v.name}
                    {Number(v.price_delta) ? ` +${fmt(v.price_delta)}` : ''}
                  </button>
                ))}
              </div>
            </div>
          )}
          {groups.map((g: any) => (
            <div key={g.id} className="mt-3">
              <p className="mb-1.5 text-xs font-semibold text-muted">
                {g.name} {g.is_required ? <span className="text-brand-600">(zorunlu)</span> : ''}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {g.modifiers.map((m: any) => (
                  <button
                    key={m.id}
                    onClick={() => toggle(g, m.id)}
                    className={`rounded-full px-3 py-1 text-xs font-medium ${(selected[g.id] ?? []).includes(m.id) ? 'bg-brand-500 text-white' : 'border border-line text-muted'}`}
                  >
                    {m.name}
                    {Number(m.price_delta) ? ` +${fmt(m.price_delta)}` : ''}
                  </button>
                ))}
              </div>
            </div>
          ))}
          <div className="mt-4 flex gap-2">
            <Button onClick={() => onAdd(variant, modifierIds, modifierNames)} disabled={missingRequired} className="flex-1">
              Sepete Ekle
            </Button>
            <Button variant="ghost" onClick={onClose}>
              İptal
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
