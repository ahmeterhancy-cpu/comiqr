'use client';

import { useMemo, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { ApiClient, ApiError } from '@comiqr/shared-types/client';
import type { AllergenRef, Menu, MenuProduct } from '@comiqr/shared-types';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://127.0.0.1:8000/v1';

interface CartLine {
  product: MenuProduct;
  qty: number;
}

export function OrderableMenu({
  menu,
  qrToken,
  tableCode,
}: {
  menu: Menu;
  qrToken: string;
  tableCode?: string;
}) {
  const t = useTranslations('order');
  const m = useTranslations('menu');
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

  const [cart, setCart] = useState<Record<number, CartLine>>({});
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
  const total = lines.reduce((s, l) => s + Number(l.product.price) * l.qty, 0);
  const count = lines.reduce((s, l) => s + l.qty, 0);

  function setQty(p: MenuProduct, qty: number) {
    setCart((c) => {
      const n = { ...c };
      if (qty <= 0) delete n[p.id];
      else n[p.id] = { product: p, qty };
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
          items: lines.map((l) => ({ product_id: l.product.id, quantity: l.qty })),
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
    <div className="mx-auto max-w-2xl pb-28">
      <header className="sticky top-0 z-10 border-b bg-canvas/90 px-5 py-4 backdrop-blur">
        <div className="flex items-baseline justify-between gap-2">
          <h1 className="text-xl font-bold text-ink">{menu.venue.name}</h1>
          <div className="flex items-center gap-2">
            <button
              onClick={() => switchLocale(locale === 'tr' ? 'en' : 'tr')}
              className="rounded-full border bg-white px-2.5 py-1 text-xs font-semibold text-muted"
            >
              {locale === 'tr' ? 'EN' : 'TR'}
            </button>
            {tableCode && (
              <span className="rounded-full bg-brand-500 px-3 py-1 text-xs font-semibold text-white">
                {tableCode}
              </span>
            )}
          </div>
        </div>
        <div className="mt-3 flex gap-2">
          <button
            onClick={() => callService('call-waiter', t('called'))}
            className="rounded-lg border bg-white px-3 py-1.5 text-xs font-medium text-ink"
          >
            {t('callWaiter')}
          </button>
          <button
            onClick={() => callService('request-bill', t('billRequested'))}
            className="rounded-lg border bg-white px-3 py-1.5 text-xs font-medium text-ink"
          >
            {t('requestBill')}
          </button>
          {service && <span className="self-center text-xs font-medium text-emerald-700">✓ {service}</span>}
        </div>
      </header>

      {order && <OrderPanel order={order} fmt={fmt} t={t} coupon={coupon} setCoupon={setCoupon} couponMsg={couponMsg} applyCoupon={applyCoupon} pay={pay} paying={paying} paid={paid} />}

      {categories.map((c) => (
        <section key={c.id} className="px-5 pt-6">
          <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-brand-600">{c.name}</h2>
          <div className="space-y-3">
            {c.products.map((p) => (
              <ProductRow
                key={p.id}
                product={p}
                qty={cart[p.id]?.qty ?? 0}
                onQty={(q: number) => setQty(p, q)}
                allergenMap={allergenMap}
                fmt={fmt}
                t={t}
                m={m}
              />
            ))}
          </div>
        </section>
      ))}

      {count > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-20 border-t bg-surface px-5 py-3 shadow-[0_-4px_16px_rgba(0,0,0,0.06)]">
          <div className="mx-auto max-w-2xl space-y-2">
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder={t('phone')}
              className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:border-brand-500"
            />
            <div className="flex items-center justify-between gap-3">
              <div className="text-sm">
                <span className="text-muted">{t('cart')}:</span>{' '}
                <b className="text-ink">{count} · {fmt.format(total)}</b>
              </div>
              <button
                onClick={placeOrder}
                disabled={placing}
                className="rounded-lg bg-brand-500 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
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
    <div className="mx-5 mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-emerald-800">
          ✓ {t('placed')} · {t('orderStatus')}: <b>{order.status}</b> (#{order.id})
        </span>
        <span className="font-bold text-ink">{fmt.format(Number(order.grand_total))}</span>
      </div>

      {paid ? (
        <p className="mt-3 font-semibold text-emerald-800">✓ {t('paid')}</p>
      ) : (
        <div className="mt-3 space-y-2">
          <div className="flex gap-2">
            <input
              value={coupon}
              onChange={(e) => setCoupon(e.target.value)}
              placeholder={t('coupon')}
              className="flex-1 rounded-lg border bg-white px-3 py-2 text-sm outline-none focus:border-brand-500"
            />
            <button onClick={applyCoupon} className="rounded-lg border bg-white px-4 py-2 text-sm font-medium">
              {t('apply')}
            </button>
          </div>
          {couponMsg && <p className="text-xs text-muted">{couponMsg}</p>}
          <button
            onClick={pay}
            disabled={paying}
            className="w-full rounded-lg bg-brand-500 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
          >
            {paying ? t('paying') : `${t('pay')} · ${fmt.format(Number(order.grand_total))}`}
          </button>
        </div>
      )}
    </div>
  );
}

function ProductRow({ product, qty, onQty, allergenMap, fmt, t, m }: any) {
  const [detail, setDetail] = useState(false);
  const n = product.nutrition;
  const contains = (n?.allergens.contains ?? []).map((id: number) => allergenMap.get(id)?.name).filter(Boolean);

  return (
    <article className="rounded-2xl border bg-surface p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        {product.images?.[0] && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={product.images[0]} alt={product.name} className="h-20 w-20 shrink-0 rounded-xl object-cover" />
        )}
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold text-ink">{product.name}</h3>
          {product.description && <p className="mt-0.5 text-sm text-muted">{product.description}</p>}
          {n && (
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">
                {Math.round(n.kcal)} {m('kcal')}
              </span>
              {n.diet.vegan && <Badge>{m('vegan')}</Badge>}
              {!n.diet.vegan && n.diet.vegetarian && <Badge>{m('vegetarian')}</Badge>}
              {n.diet.gluten_free && <Badge>{m('glutenFree')}</Badge>}
            </div>
          )}
          {contains.length > 0 && (
            <p className="mt-1.5 text-xs text-muted">{m('contains')}: {contains.join(', ')}</p>
          )}
          {n && (
            <button onClick={() => setDetail((v) => !v)} className="mt-1.5 text-xs font-medium text-brand-600">
              {t('detail')} {detail ? '▲' : '▼'}
            </button>
          )}
          {n && detail && (
            <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 rounded-lg bg-canvas p-3 text-xs text-ink/80">
              <Detail label={m('protein')} value={`${n.macros.protein_g} g`} />
              <Detail label={m('carb')} value={`${n.macros.carb_g} g`} />
              <Detail label={m('fat')} value={`${n.macros.fat_g} g`} />
              <Detail label={t('saturatedFat')} value={`${n.detail.saturated_fat_g} g`} />
              <Detail label={t('sugar')} value={`${n.detail.sugar_g} g`} />
              <Detail label={t('fiber')} value={`${n.detail.fiber_g} g`} />
              <Detail label={t('sodium')} value={`${n.detail.sodium_mg} mg`} />
            </div>
          )}
        </div>
        <div className="shrink-0 text-right">
          <div className="font-bold text-ink">{fmt.format(Number(product.price))}</div>
          <div className="mt-2">
            {qty === 0 ? (
              <button onClick={() => onQty(1)} className="rounded-lg border border-brand-500 px-3 py-1 text-sm font-semibold text-brand-600">
                {t('add')}
              </button>
            ) : (
              <div className="inline-flex items-center gap-2 rounded-lg border">
                <button onClick={() => onQty(qty - 1)} className="h-8 w-8 text-lg font-bold text-brand-600">−</button>
                <span className="min-w-5 text-center text-sm font-semibold">{qty}</span>
                <button onClick={() => onQty(qty + 1)} className="h-8 w-8 text-lg font-bold text-brand-600">+</button>
              </div>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}

function Badge({ children }: { children: React.ReactNode }) {
  return <span className="rounded-md bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800">{children}</span>;
}
function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-muted">{label}</span>
      <span className="font-medium text-ink">{value}</span>
    </div>
  );
}
