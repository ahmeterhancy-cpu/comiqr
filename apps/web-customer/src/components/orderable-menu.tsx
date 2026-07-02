'use client';

import { useMemo, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { ApiClient, ApiError } from '@comiqr/shared-types/client';
import type { AllergenRef, Menu, MenuModifierGroup, MenuProduct } from '@comiqr/shared-types';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://127.0.0.1:8000/v1';

interface CartLine {
  key: string;
  product: MenuProduct;
  qty: number;
  variantId?: number;
  modifierIds: number[];
  modifierNames: string[];
  variantName?: string;
  unitPrice: number;
}

/** Stable identity for a cart line: same product + variant + modifier set collapses into one line. */
function lineKey(productId: number, variantId: number | undefined, modifierIds: number[]): string {
  return `${productId}::${variantId ?? 0}::${[...modifierIds].sort((a, b) => a - b).join(',')}`;
}

export function OrderableMenu({ menu, qrToken, tableCode }: { menu: Menu; qrToken: string; tableCode?: string }) {
  const t = useTranslations('order');
  const mt = useTranslations('menu');
  const locale = useLocale();
  const api = useMemo(() => new ApiClient({ baseUrl: API_URL }), []);

  const allergenMap = useMemo(
    () => new Map<number, AllergenRef>(menu.allergens.map((a) => [a.id, a])),
    [menu.allergens],
  );
  const fmt = useMemo(
    () =>
      new Intl.NumberFormat(menu.venue.locale_default ?? 'tr', {
        style: 'currency',
        currency: menu.venue.currency || 'TRY',
        maximumFractionDigits: 0,
      }),
    [menu.venue],
  );

  const [cart, setCart] = useState<Record<string, CartLine>>({});
  const [phone, setPhone] = useState('');
  const [placing, setPlacing] = useState(false);
  const [order, setOrder] = useState<any | null>(null);
  const [coupon, setCoupon] = useState('');
  const [couponMsg, setCouponMsg] = useState<string | null>(null);
  const [paying, setPaying] = useState(false);
  const [paid, setPaid] = useState(false);
  const [service, setService] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const lines = Object.values(cart);
  const total = lines.reduce((s, l) => s + l.unitPrice * l.qty, 0);
  const count = lines.reduce((s, l) => s + l.qty, 0);

  function qtyFor(productId: number, variantId: number | undefined, modifierIds: number[]): number {
    return cart[lineKey(productId, variantId, modifierIds)]?.qty ?? 0;
  }

  function setLineQty(sel: Omit<CartLine, 'key' | 'qty'>, qty: number) {
    const key = lineKey(sel.product.id, sel.variantId, sel.modifierIds);
    setCart((c) => {
      const n = { ...c };
      if (qty <= 0) delete n[key];
      else n[key] = { ...sel, key, qty };
      return n;
    });
  }

  function switchLocale(l: string) {
    document.cookie = `locale=${l};path=/;max-age=31536000`;
    window.location.reload();
  }

  async function callService(path: string, label: string) {
    try {
      await api.request(`/sessions/${encodeURIComponent(qrToken)}/${path}`, { method: 'POST' });
      setService(label);
      setTimeout(() => setService(null), 4000);
    } catch {
      /* ignore */
    }
  }

  async function placeOrder() {
    setPlacing(true);
    setError(null);
    try {
      const res = await api.request<any>(`/sessions/${encodeURIComponent(qrToken)}/orders`, {
        method: 'POST',
        body: JSON.stringify({
          items: lines.map((l) => ({
            product_id: l.product.id,
            quantity: l.qty,
            variant_id: l.variantId,
            modifiers: l.modifierIds,
          })),
          customer: phone ? { phone } : undefined,
        }),
      });
      setOrder(res);
      setCart({});
    } catch {
      setError(t('error'));
    } finally {
      setPlacing(false);
    }
  }

  async function applyCoupon() {
    setCouponMsg(null);
    try {
      const res = await api.request<any>(
        `/sessions/${encodeURIComponent(qrToken)}/orders/${order.id}/apply-coupon`,
        { method: 'POST', body: JSON.stringify({ code: coupon }) },
      );
      setOrder(res);
      setCouponMsg(t('couponApplied'));
    } catch (e) {
      setCouponMsg(e instanceof ApiError ? t('couponError') : t('error'));
    }
  }

  async function pay() {
    setPaying(true);
    try {
      await api.request(`/sessions/${encodeURIComponent(qrToken)}/orders/${order.id}/pay`, {
        method: 'POST',
        body: JSON.stringify({ gateway: 'cash' }),
      });
      setPaid(true);
    } catch {
      /* ignore */
    } finally {
      setPaying(false);
    }
  }

  const categories = menu.categories.filter((c) => c.products.length > 0);

  return (
    <div className="mx-auto max-w-2xl pb-32">
      {/* Editorial header */}
      <header className="relative overflow-hidden bg-brand-600 px-6 pb-7 pt-8 text-white">
        <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/10" />
        <div className="relative flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-white/70">Menü</p>
            <h1 className="mt-1 font-display text-3xl font-semibold leading-tight">{menu.venue.name}</h1>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button
              onClick={() => switchLocale(locale === 'tr' ? 'en' : 'tr')}
              className="rounded-full bg-white/15 px-3 py-1 text-xs font-semibold backdrop-blur"
            >
              {locale === 'tr' ? 'EN' : 'TR'}
            </button>
            {tableCode && (
              <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-brand-700">{tableCode}</span>
            )}
          </div>
        </div>
        <div className="relative mt-5 flex items-center gap-2">
          <button
            onClick={() => callService('call-waiter', t('called'))}
            className="rounded-full bg-white/15 px-4 py-1.5 text-xs font-semibold backdrop-blur transition hover:bg-white/25"
          >
            {t('callWaiter')}
          </button>
          <button
            onClick={() => callService('request-bill', t('requestBill'))}
            className="rounded-full bg-white/15 px-4 py-1.5 text-xs font-semibold backdrop-blur transition hover:bg-white/25"
          >
            {t('requestBill')}
          </button>
          {service && <span className="text-xs font-medium text-white/90">✓ {service}</span>}
        </div>
      </header>

      {/* Sticky category nav */}
      {categories.length > 1 && (
        <nav className="sticky top-0 z-10 flex gap-2 overflow-x-auto border-b border-line bg-canvas/90 px-5 py-3 backdrop-blur">
          {categories.map((c) => (
            <a
              key={c.id}
              href={`#cat-${c.id}`}
              className="whitespace-nowrap rounded-full border border-line bg-surface px-3.5 py-1.5 text-xs font-medium text-muted transition hover:border-brand-500 hover:text-brand-600"
            >
              {c.name}
            </a>
          ))}
        </nav>
      )}

      {order && (
        <OrderPanel
          order={order}
          fmt={fmt}
          t={t}
          coupon={coupon}
          setCoupon={setCoupon}
          couponMsg={couponMsg}
          applyCoupon={applyCoupon}
          pay={pay}
          paying={paying}
          paid={paid}
        />
      )}

      {categories.map((c) => (
        <section key={c.id} id={`cat-${c.id}`} className="scroll-mt-16 px-5 pt-8">
          <div className="mb-4 flex items-center gap-3">
            <h2 className="font-display text-xl font-semibold text-ink">{c.name}</h2>
            <span className="h-px flex-1 bg-line" />
          </div>
          <div className="space-y-3.5">
            {c.products.map((p) => (
              <ProductRow
                key={p.id}
                product={p}
                qtyFor={qtyFor}
                onSet={setLineQty}
                allergenMap={allergenMap}
                fmt={fmt}
                t={t}
                mt={mt}
              />
            ))}
          </div>
        </section>
      ))}

      {/* Cart bar */}
      {count > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-surface/95 px-5 pb-4 pt-3 shadow-[0_-8px_28px_rgba(38,32,28,0.08)] backdrop-blur">
          <div className="mx-auto max-w-2xl space-y-2.5">
            {lines.length > 0 && (
              <ul className="max-h-32 space-y-1 overflow-y-auto text-xs text-muted">
                {lines.map((l) => (
                  <li key={l.key} className="flex items-start justify-between gap-2">
                    <span className="min-w-0">
                      <b className="font-semibold text-ink">{l.qty}×</b> {l.product.name}
                      {l.variantName ? ` · ${l.variantName}` : ''}
                      {l.modifierNames.length > 0 && (
                        <span className="text-muted"> · {l.modifierNames.join(', ')}</span>
                      )}
                    </span>
                    <span className="shrink-0 font-medium text-ink">{fmt.format(l.unitPrice * l.qty)}</span>
                  </li>
                ))}
              </ul>
            )}
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder={t('phone')}
              className="w-full rounded-xl border border-line bg-canvas px-3.5 py-2.5 text-sm outline-none transition focus:border-brand-500 focus:bg-white"
            />
            <div className="flex items-center justify-between gap-3">
              <div className="text-sm text-muted">
                {count} {t('cart').toLowerCase()} ·{' '}
                <b className="font-display text-base text-ink">{fmt.format(total)}</b>
              </div>
              <button
                onClick={placeOrder}
                disabled={placing}
                className="rounded-xl bg-brand-500 px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-600 disabled:opacity-60"
              >
                {placing ? t('placing') : t('placeOrder')}
              </button>
            </div>
            {error && <p className="text-xs text-red-600">{error}</p>}
          </div>
        </div>
      )}
    </div>
  );
}

function OrderPanel({ order, fmt, t, coupon, setCoupon, couponMsg, applyCoupon, pay, paying, paid }: any) {
  return (
    <div className="mx-5 mt-5 overflow-hidden rounded-2xl border border-sage/30 bg-sage-bg">
      <div className="flex items-center justify-between px-5 py-4">
        <span className="text-sm font-medium text-[color:var(--color-sage)]">
          ✓ {t('placed')} · {order.status} <span className="text-muted">(#{order.id})</span>
        </span>
        <span className="font-display text-lg font-semibold text-ink">{fmt.format(Number(order.grand_total))}</span>
      </div>
      {paid ? (
        <p className="px-5 pb-4 font-semibold text-[color:var(--color-sage)]">✓ {t('paid')}</p>
      ) : (
        <div className="space-y-2 border-t border-sage/20 bg-white/60 px-5 py-4">
          <div className="flex gap-2">
            <input
              value={coupon}
              onChange={(e) => setCoupon(e.target.value)}
              placeholder={t('coupon')}
              className="flex-1 rounded-xl border border-line bg-white px-3.5 py-2.5 text-sm outline-none focus:border-brand-500"
            />
            <button onClick={applyCoupon} className="rounded-xl border border-line bg-white px-4 py-2 text-sm font-medium">
              {t('apply')}
            </button>
          </div>
          {couponMsg && <p className="text-xs text-muted">{couponMsg}</p>}
          <button
            onClick={pay}
            disabled={paying}
            className="w-full rounded-xl bg-brand-500 py-3 text-sm font-semibold text-white transition hover:bg-brand-600 disabled:opacity-60"
          >
            {paying ? t('paying') : `${t('pay')} · ${fmt.format(Number(order.grand_total))}`}
          </button>
        </div>
      )}
    </div>
  );
}

function ProductRow({ product, qtyFor, onSet, allergenMap, fmt, t, mt }: any) {
  const [detail, setDetail] = useState(false);
  const variants = product.variants ?? [];
  const groups: MenuModifierGroup[] = product.modifier_groups ?? [];

  const [variantId, setVariantId] = useState<number | undefined>(
    variants.find((v: any) => v.is_default)?.id ?? variants[0]?.id,
  );
  // groupId -> selected modifier ids
  const [selected, setSelected] = useState<Record<number, number[]>>({});

  const n = product.nutrition;
  const contains = (n?.allergens.contains ?? []).map((id: number) => allergenMap.get(id)?.name).filter(Boolean);

  const variant = variants.find((v: any) => v.id === variantId);

  // Flatten current modifier selection in group order for a stable, priced line.
  const chosen = groups.flatMap((g) =>
    (selected[g.id] ?? []).map((id) => g.modifiers.find((m) => m.id === id)).filter(Boolean),
  ) as { id: number; name: string; price_delta: string | number }[];
  const modifierIds = chosen.map((m) => m.id);
  const modifierNames = chosen.map((m) => m.name);
  const modTotal = chosen.reduce((s, m) => s + Number(m.price_delta), 0);
  const unitPrice = Number(product.price) + Number(variant?.price_delta ?? 0) + modTotal;

  const missingRequired = groups.some((g) => {
    const min = g.is_required ? Math.max(1, g.min_select) : g.min_select;
    return (selected[g.id] ?? []).length < min;
  });

  const cartQty = qtyFor(product.id, variantId, modifierIds);

  const selection = () => ({
    product,
    variantId,
    variantName: variant?.name,
    modifierIds,
    modifierNames,
    unitPrice,
  });

  function toggleModifier(g: MenuModifierGroup, id: number) {
    setSelected((prev) => {
      const cur = prev[g.id] ?? [];
      let next: number[];
      if (g.max_select <= 1) {
        // Single choice: re-selecting clears it only when the group is optional.
        next = cur.includes(id) ? (g.is_required ? cur : []) : [id];
      } else if (cur.includes(id)) {
        next = cur.filter((x) => x !== id);
      } else if (cur.length < g.max_select) {
        next = [...cur, id];
      } else {
        next = cur; // at the cap — ignore extra taps
      }
      return { ...prev, [g.id]: next };
    });
  }

  return (
    <article className="overflow-hidden rounded-2xl border border-line bg-surface shadow-[var(--shadow-card)]">
      <div className="flex gap-4 p-4">
        {product.images?.[0] && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={product.images[0]} alt={product.name} className="h-24 w-24 shrink-0 rounded-xl object-cover" />
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <h3 className="font-display text-lg font-semibold leading-snug text-ink">{product.name}</h3>
            <div className="shrink-0 font-display text-lg font-semibold text-ink">{fmt.format(unitPrice)}</div>
          </div>
          {product.description && <p className="mt-1 text-sm leading-relaxed text-muted">{product.description}</p>}

          {n && (
            <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
              <span className="rounded-full bg-amber-bg px-2.5 py-0.5 text-xs font-semibold text-[color:var(--color-amber)]">
                {Math.round(n.kcal)} {mt('kcal')}
              </span>
              {n.diet.vegan && <Diet>{mt('vegan')}</Diet>}
              {!n.diet.vegan && n.diet.vegetarian && <Diet>{mt('vegetarian')}</Diet>}
              {n.diet.gluten_free && <Diet>{mt('glutenFree')}</Diet>}
            </div>
          )}
          {contains.length > 0 && (
            <p className="mt-2 text-xs text-muted">
              <span className="font-medium text-ink/60">{mt('contains')}:</span> {contains.join(', ')}
            </p>
          )}
          {n && (
            <button onClick={() => setDetail((v) => !v)} className="mt-2 text-xs font-semibold text-brand-600">
              {t('detail')} {detail ? '▲' : '▼'}
            </button>
          )}
          {n && detail && (
            <div className="mt-2 grid grid-cols-2 gap-x-6 gap-y-1.5 rounded-xl bg-canvas p-3.5 text-xs">
              <Detail label={mt('protein')} value={`${n.macros.protein_g} g`} />
              <Detail label={mt('carb')} value={`${n.macros.carb_g} g`} />
              <Detail label={mt('fat')} value={`${n.macros.fat_g} g`} />
              <Detail label={t('saturatedFat')} value={`${n.detail.saturated_fat_g} g`} />
              <Detail label={t('sugar')} value={`${n.detail.sugar_g} g`} />
              <Detail label={t('fiber')} value={`${n.detail.fiber_g} g`} />
              <Detail label={t('sodium')} value={`${n.detail.sodium_mg} mg`} />
            </div>
          )}

          {variants.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {variants.map((v: any) => (
                <button
                  key={v.id}
                  onClick={() => setVariantId(v.id)}
                  className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                    v.id === variantId
                      ? 'bg-brand-500 text-white'
                      : 'border border-line bg-surface text-muted hover:border-brand-500'
                  }`}
                >
                  {v.name}
                  {Number(v.price_delta) ? ` +${fmt.format(Number(v.price_delta))}` : ''}
                </button>
              ))}
            </div>
          )}

          {groups.map((g) => (
            <div key={g.id} className="mt-3">
              <div className="mb-1.5 flex items-center gap-2">
                <span className="text-xs font-semibold text-ink">{g.name}</span>
                {g.is_required ? (
                  <span className="rounded-full bg-brand-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-brand-600">
                    {t('required')}
                  </span>
                ) : (
                  <span className="text-[10px] text-muted">
                    {g.max_select > 1 ? t('upTo', { count: g.max_select }) : t('optional')}
                  </span>
                )}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {g.modifiers.map((m) => {
                  const on = (selected[g.id] ?? []).includes(m.id);
                  return (
                    <button
                      key={m.id}
                      onClick={() => toggleModifier(g, m.id)}
                      className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                        on
                          ? 'bg-brand-500 text-white'
                          : 'border border-line bg-surface text-muted hover:border-brand-500'
                      }`}
                    >
                      {g.max_select <= 1 && on ? '● ' : ''}
                      {m.name}
                      {Number(m.price_delta) ? ` +${fmt.format(Number(m.price_delta))}` : ''}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}

          <div className="mt-3.5 flex items-center justify-end gap-3">
            {missingRequired && cartQty === 0 && (
              <span className="text-[11px] text-muted">{t('chooseRequired')}</span>
            )}
            {cartQty === 0 ? (
              <button
                onClick={() => onSet(selection(), 1)}
                disabled={missingRequired}
                className="inline-flex items-center gap-1.5 rounded-full bg-brand-500 px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-600 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <span className="text-base leading-none">+</span> {t('add')}
              </button>
            ) : (
              <div className="inline-flex items-center gap-2 rounded-full bg-brand-500 p-1 pr-1 shadow-sm">
                <Step onClick={() => onSet(selection(), cartQty - 1)}>−</Step>
                <span className="min-w-5 text-center text-sm font-bold text-white">{cartQty}</span>
                <Step onClick={() => onSet(selection(), cartQty + 1)}>+</Step>
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
    <button onClick={onClick} className="grid h-7 w-7 place-items-center rounded-lg bg-white text-lg font-bold text-brand-600 shadow-sm">
      {children}
    </button>
  );
}
function Diet({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full bg-sage-bg px-2.5 py-0.5 text-xs font-medium text-[color:var(--color-sage)]">
      {children}
    </span>
  );
}
function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-muted">{label}</span>
      <span className="font-semibold text-ink">{value}</span>
    </div>
  );
}
