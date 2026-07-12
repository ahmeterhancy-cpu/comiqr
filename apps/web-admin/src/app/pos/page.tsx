'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getActiveBranchId } from '@/lib/branch';
import { createEcho } from '@/lib/echo';
import { useApi } from '@/lib/useApi';
import {
  Customizer,
  DiscountModal,
  KdsPanel,
  Modal,
  money,
  PaymentModal,
  printReceipt,
  RecallDrawer,
  RefundModal,
  ShiftModal,
  TableMapModal,
} from '@/components/pos-kit';

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

const productImg = (p: any): string | undefined => p?.images?.[0] ?? p?.image_paths_json?.[0] ?? p?.image_path;

/**
 * Ultra POS (Faz 3) — a full-screen, independent cashier terminal (no admin
 * sidebar). Build a ticket from the product grid, seat it at a table, add rounds
 * to open tabs, discount, void, and settle with split cash/card, room charge or
 * a printed receipt — plus a cash-drawer shift with a Z-report.
 */
export default function PosPage() {
  const router = useRouter();
  const { api, me, ready } = useApi('/pos/login');
  const isCashier = me?.user.role === 'cashier';
  const currency = (me?.tenant as any)?.currency ?? 'TRY';
  const venueName = (me?.tenant as any)?.name ?? 'ComiQR';
  const vertical = (me?.tenant as any)?.settings?.vertical ?? 'restaurant';
  const canRoomCharge = ['hotel', 'beach'].includes(vertical);

  const [products, setProducts] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [tables, setTables] = useState<any[]>([]);
  const [shift, setShift] = useState<any | null>(null);
  const [activeBranch, setActiveBranch] = useState<number | null>(null);
  const [activeCat, setActiveCat] = useState<number | null>(null);
  const [search, setSearch] = useState('');
  const [favorites, setFavorites] = useState<number[]>([]);
  const [favView, setFavView] = useState(false);

  const [cart, setCart] = useState<Record<string, Line>>({});
  const [order, setOrder] = useState<any | null>(null);
  const [orderType, setOrderType] = useState<'table' | 'takeaway'>('table');
  const [tableId, setTableId] = useState<number | null>(null);
  const [tableCode, setTableCode] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState<Date>(() => new Date());

  // Modals
  const [customizing, setCustomizing] = useState<any | null>(null);
  const [showMap, setShowMap] = useState(false);
  const [showDiscount, setShowDiscount] = useState(false);
  const [lineDisc, setLineDisc] = useState<any | null>(null);
  const [payOrder, setPayOrder] = useState<any | null>(null);
  const [refundOrder, setRefundOrder] = useState<any | null>(null);
  const [showRecall, setShowRecall] = useState(false);
  const [recallOrders, setRecallOrders] = useState<any[]>([]);
  const [recallScope, setRecallScope] = useState<'open' | 'today'>('open');
  const [liveTick, setLiveTick] = useState(0);
  const [liveAlert, setLiveAlert] = useState(false);
  const [showShift, setShowShift] = useState(false);
  const [showKds, setShowKds] = useState(false);
  const [receipt, setReceipt] = useState<any | null>(null);

  const load = useCallback(async () => {
    const stored = getActiveBranchId();
    const [ps, cs, ts, bs] = await Promise.all([
      api.adminProducts(),
      api.adminCategories(),
      api.adminTables(),
      api.adminBranches().catch(() => [] as any[]),
    ]);
    // Validate the stored branch against the tenant's real branches so a stale or
    // foreign id can't be baked into every write (order/pay/shift would 404).
    const branch = bs.find((b: any) => b.id === stored)?.id ?? bs[0]?.id ?? null;
    setActiveBranch(branch);
    setProducts(ps.filter((p: any) => p.is_active));
    setCategories(cs);
    setTables(ts);
    setShift(await api.posShift(branch ?? undefined).catch(() => null));
  }, [api]);

  useEffect(() => {
    if (ready) load();
  }, [ready, load]);

  // Live recall via Reverb (M6/M10): new orders / status changes on this branch
  // refresh the open Adisyonlar drawer, or flag the button. Degrades gracefully to
  // refetch-on-open when Reverb is offline (local `log` broadcaster).
  useEffect(() => {
    if (!ready || !activeBranch) return;
    const echo = createEcho();
    if (!echo) return;
    const name = `branch.${activeBranch}.orders`;
    const ch = echo.private(name);
    const bump = () => setLiveTick((n) => n + 1);
    ch.listen('.OrderPlaced', bump);
    ch.listen('.OrderItemStatusChanged', bump);
    return () => {
      try {
        echo.leave(name);
        echo.disconnect();
      } catch {
        /* ignore */
      }
    };
  }, [ready, activeBranch]);

  useEffect(() => {
    if (liveTick === 0) return;
    if (showRecall) loadRecall(recallScope);
    else setLiveAlert(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [liveTick]);

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const favKey = `comiqr.pos.fav.${(me?.tenant as any)?.id ?? 'x'}`;
  useEffect(() => {
    try {
      const raw = localStorage.getItem(favKey);
      setFavorites(raw ? JSON.parse(raw) : []);
    } catch {
      /* ignore */
    }
  }, [favKey]);

  function toggleFav(id: number) {
    setFavorites((f) => {
      const next = f.includes(id) ? f.filter((x) => x !== id) : [...f, id];
      try {
        localStorage.setItem(favKey, JSON.stringify(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  }

  const productName = useMemo(() => {
    const m = new Map<number, string>();
    for (const p of products) m.set(p.id, p.name);
    return (id: number) => m.get(id) ?? `#${id}`;
  }, [products]);

  const shown = useMemo(() => {
    const q = search.trim().toLocaleLowerCase('tr');
    return products.filter(
      (p) =>
        (favView ? favorites.includes(p.id) : activeCat ? p.category_id === activeCat : true) &&
        (q ? p.name.toLocaleLowerCase('tr').includes(q) : true),
    );
  }, [products, activeCat, search, favView, favorites]);

  // --- Cart ---------------------------------------------------------------
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
  const cartTotal = cartLines.reduce((s, l) => s + l.unitPrice * l.qty, 0);
  const committedItems = (order?.items ?? []).filter((i: any) => i.status !== 'cancelled');
  const runningSubtotal = Number(order?.subtotal ?? 0) + cartTotal;
  const discountTotal = Number(order?.discount_total ?? 0);
  const grandTotal = Number(order?.grand_total ?? 0) + cartTotal;

  function itemsPayload() {
    return cartLines.map((l) => ({
      product_id: l.product.id,
      variant_id: l.variantId,
      quantity: l.qty,
      modifiers: l.modifierIds,
    }));
  }

  function resetTicket() {
    setOrder(null);
    setCart({});
    setNote('');
    setTableId(null);
    setTableCode(null);
    setOrderType('table');
    setError(null);
  }

  /** Persist any pending cart lines (create the order or add a round). */
  async function send(): Promise<any | null> {
    setError(null);
    const items = itemsPayload();
    if (items.length === 0) return order;
    // A dine-in ticket must be seated before it is sent — otherwise it would
    // silently become a takeaway. Prompt for the table instead.
    if (!order && orderType === 'table' && !tableId) {
      setShowMap(true);
      return null;
    }
    setBusy(true);
    try {
      const res = order
        ? await api.posAddItems(order.id, items)
        : await api.posOrder({
            table_id: orderType === 'table' && tableId ? tableId : undefined,
            branch_id: activeBranch ?? undefined,
            items,
            note: note || undefined,
          });
      setOrder(res);
      setCart({});
      return res;
    } catch (e: any) {
      setError(e?.message ?? 'Sipariş kaydedilemedi.');
      return null;
    } finally {
      setBusy(false);
    }
  }

  async function onSendToKitchen() {
    if (cartLines.length === 0) return;
    await send();
  }

  async function onPay() {
    const o = await send();
    if (!o || (o.items ?? []).filter((i: any) => i.status !== 'cancelled').length === 0) return;
    setPayOrder(o);
  }

  async function onDiscount() {
    const o = await send();
    if (!o) return;
    setOrder(o);
    setShowDiscount(true);
  }

  async function applyDiscount(type: 'percent' | 'amount', value: number, reason?: string) {
    setShowDiscount(false);
    if (!order) return;
    try {
      const res = await api.posDiscount(order.id, { type, value, reason });
      setOrder(res);
    } catch (e: any) {
      setError(e?.message ?? 'İndirim uygulanamadı.');
    }
  }

  async function applyServiceCharge(percent: number) {
    if (!order) return;
    try {
      setOrder(await api.posServiceCharge(order.id, percent));
    } catch (e: any) {
      setError(e?.message ?? 'Servis ücreti uygulanamadı.');
    }
  }

  async function voidCommitted(itemId: number) {
    if (!order) return;
    try {
      const res = await api.posVoidItem(order.id, itemId);
      setOrder(res);
    } catch (e: any) {
      setError(e?.message ?? 'Ürün çıkarılamadı.');
    }
  }

  async function onPark() {
    const o = await send();
    if (o) resetTicket();
    load(); // refresh table occupancy
  }

  async function loadRecall(scope: 'open' | 'today') {
    setRecallScope(scope);
    setLiveAlert(false);
    try {
      const list = await api.posOrders({ scope, branch_id: activeBranch ?? undefined });
      setRecallOrders(list);
      setShowRecall(true);
    } catch {
      setError('Adisyonlar yüklenemedi.');
    }
  }

  function pickRecalled(o: any) {
    setShowRecall(false);
    setOrder(o);
    setCart({});
    setNote(o.note ?? '');
    setOrderType(o.table_code ? 'table' : 'takeaway');
    setTableCode(o.table_code ?? null);
    setTableId(null); // adding rounds uses the order id, not the table
  }

  function onPaid(finalOrder: any) {
    setPayOrder(null);
    setReceipt(finalOrder);
    load();
  }

  if (!ready) {
    return <div className="grid h-screen place-items-center bg-canvas text-muted">Yükleniyor…</div>;
  }

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-canvas text-ink">
      {/* Top chrome */}
      <header className="flex items-center justify-between gap-3 bg-slate-900 px-4 py-2.5 text-white">
        <div className="flex items-center gap-3">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand-500 font-black">K</span>
          <div className="leading-tight">
            <div className="text-sm font-bold">{venueName} · KASA</div>
            <div className="text-[11px] text-white/60">{now.toLocaleTimeString('tr-TR')}</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowShift(true)}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${
              shift ? 'bg-emerald-500/20 text-emerald-300' : 'bg-white/10 text-white/80 hover:bg-white/20'
            }`}
          >
            {shift ? `🟢 Vardiya · ${money(shift.expected_cash, currency)}` : '🔒 Kasa Kapalı'}
          </button>
          {!isCashier && (
            <button onClick={() => setShowKds(true)} className="rounded-lg bg-white/10 px-3 py-1.5 text-xs font-semibold hover:bg-white/20">
              🍳 Mutfak
            </button>
          )}
          <button onClick={() => loadRecall('open')} className="relative rounded-lg bg-white/10 px-3 py-1.5 text-xs font-semibold hover:bg-white/20">
            📋 Adisyonlar
            {liveAlert && <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full bg-red-500 ring-2 ring-slate-900" />}
          </button>
          {!isCashier && (
            <button
              onClick={() => router.push('/dashboard')}
              className="rounded-lg bg-white/10 px-3 py-1.5 text-xs font-semibold hover:bg-white/20"
            >
              ← Panel
            </button>
          )}
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        {/* Product picker */}
        <main className="flex min-w-0 flex-1 flex-col border-r border-line">
          <div className="flex items-center gap-2 border-b border-line bg-surface px-4 py-2.5">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Ürün ara…"
              className="w-56 rounded-lg border border-line px-3 py-2 text-sm outline-none focus:border-brand-500"
            />
            <div className="flex flex-1 gap-1.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {favorites.length > 0 && (
                <CatPill active={favView} onClick={() => setFavView(true)}>
                  ⭐ Sık
                </CatPill>
              )}
              <CatPill active={!favView && activeCat === null} onClick={() => { setFavView(false); setActiveCat(null); }}>
                Tümü
              </CatPill>
              {categories.map((c) => (
                <CatPill key={c.id} active={!favView && activeCat === c.id} onClick={() => { setFavView(false); setActiveCat(c.id); }}>
                  {c.name}
                </CatPill>
              ))}
            </div>
          </div>

          <div className="grid flex-1 auto-rows-min grid-cols-2 gap-2.5 overflow-y-auto p-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {shown.map((p) => (
              <button
                key={p.id}
                onClick={() => pick(p)}
                className="flex flex-col overflow-hidden rounded-xl border border-line bg-surface text-left transition hover:border-brand-400 hover:shadow-md active:scale-[0.98]"
              >
                <div className="relative aspect-[4/3] w-full bg-canvas">
                  {productImg(p) ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={productImg(p)} alt={p.name} className="h-full w-full object-cover" />
                  ) : (
                    <div className="grid h-full w-full place-items-center text-2xl font-black text-line">
                      {p.name.slice(0, 2)}
                    </div>
                  )}
                  {p.age_restricted && (
                    <span className="absolute right-1 top-1 rounded bg-red-600 px-1 text-[10px] font-bold text-white">
                      18+
                    </span>
                  )}
                  <span
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleFav(p.id);
                    }}
                    className="absolute left-1 top-1 cursor-pointer rounded-full bg-white/85 px-1 text-sm leading-none shadow-sm"
                  >
                    {favorites.includes(p.id) ? '⭐' : '☆'}
                  </span>
                </div>
                <div className="flex flex-1 flex-col p-2">
                  <div className="line-clamp-2 text-xs font-semibold leading-tight text-ink">{p.name}</div>
                  <div className="mt-auto flex items-center justify-between pt-1">
                    <span className="text-sm font-bold text-brand-600">{money(p.price, currency)}</span>
                    {(p.variants?.length > 0 || p.modifier_groups?.length > 0) && (
                      <span className="text-[10px] text-muted">seçenek</span>
                    )}
                  </div>
                </div>
              </button>
            ))}
            {shown.length === 0 && <p className="col-span-full py-10 text-center text-sm text-muted">Ürün bulunamadı.</p>}
          </div>
        </main>

        {/* Ticket */}
        <aside className="flex w-[360px] shrink-0 flex-col bg-surface xl:w-[400px]">
          {/* Order context */}
          <div className="border-b border-line p-3">
            <div className="mb-2 grid grid-cols-2 gap-1.5">
              <SegBtn active={orderType === 'table'} onClick={() => setOrderType('table')} disabled={!!order}>
                🍽️ Masa
              </SegBtn>
              <SegBtn active={orderType === 'takeaway'} onClick={() => { setOrderType('takeaway'); setTableId(null); setTableCode(null); }} disabled={!!order}>
                🛍️ Gel-Al
              </SegBtn>
            </div>
            <div className="flex items-center justify-between">
              <button
                onClick={() => !order && orderType === 'table' && setShowMap(true)}
                className="text-sm font-bold text-ink disabled:opacity-100"
                disabled={!!order}
              >
                {order
                  ? `Adisyon #${order.id}${tableCode ? ` · ${tableCode}` : ''}`
                  : orderType === 'table'
                    ? tableCode
                      ? `${tableCode} ✎`
                      : 'Masa Seç →'
                    : 'Gel-Al'}
              </button>
              {order && (
                <button onClick={resetTicket} className="text-xs font-semibold text-brand-600 hover:underline">
                  + Yeni
                </button>
              )}
            </div>
          </div>

          {/* Lines */}
          <div className="min-h-0 flex-1 overflow-y-auto p-3">
            {committedItems.length === 0 && cartLines.length === 0 ? (
              <p className="py-12 text-center text-sm text-muted">Ürün ekleyin…</p>
            ) : (
              <ul className="space-y-1.5">
                {committedItems.map((i: any) => (
                  <li key={`c${i.id}`} className="flex items-start justify-between gap-2 rounded-lg bg-canvas px-2.5 py-2 text-sm">
                    <div className="min-w-0">
                      <div className="font-medium text-ink">
                        <span className="text-muted">{i.quantity}×</span> {i.product_name ?? productName(i.product_id)}
                      </div>
                      {(i.modifiers ?? []).length > 0 && (
                        <div className="text-[11px] text-muted">{i.modifiers.map((m: any) => m.name).join(' · ')}</div>
                      )}
                      <span className="text-[10px] font-semibold uppercase text-emerald-600">✓ gönderildi</span>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <span className="text-xs font-semibold text-ink">
                        {Number(i.discount_total) > 0 && (
                          <span className="mr-1 text-[10px] font-normal text-muted line-through">
                            {money(Number(i.unit_price) * i.quantity, currency)}
                          </span>
                        )}
                        {money(i.line_total, currency)}
                      </span>
                      {order?.payment_status !== 'paid' && (
                        <div className="flex gap-2">
                          <button onClick={() => setLineDisc(i)} className="text-[11px] text-brand-600 hover:underline">
                            % indir
                          </button>
                          <button onClick={() => voidCommitted(i.id)} className="text-[11px] text-red-500 hover:underline">
                            çıkar
                          </button>
                        </div>
                      )}
                    </div>
                  </li>
                ))}
                {cartLines.map((l) => (
                  <li key={l.key} className="flex items-start justify-between gap-2 rounded-lg border border-brand-100 bg-brand-50/40 px-2.5 py-2 text-sm">
                    <div className="min-w-0">
                      <div className="font-medium text-ink">{l.product.name}</div>
                      {(l.variantName || l.modifierNames.length > 0) && (
                        <div className="text-[11px] text-muted">{[l.variantName, ...l.modifierNames].filter(Boolean).join(' · ')}</div>
                      )}
                    </div>
                    <div className="flex shrink-0 items-center gap-1.5">
                      <button onClick={() => setQty(l.key, l.qty - 1)} className="grid h-7 w-7 place-items-center rounded-md bg-white text-ink shadow-sm">−</button>
                      <span className="w-5 text-center font-bold text-ink">{l.qty}</span>
                      <button onClick={() => setQty(l.key, l.qty + 1)} className="grid h-7 w-7 place-items-center rounded-md bg-white text-ink shadow-sm">+</button>
                      <span className="w-16 text-right text-xs font-semibold text-ink">{money(l.unitPrice * l.qty, currency)}</span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Totals + actions */}
          <div className="border-t border-line p-3">
            {!order && (
              <input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Sipariş notu…"
                className="mb-2 w-full rounded-lg border border-line px-3 py-2 text-sm outline-none focus:border-brand-500"
              />
            )}
            <div className="mb-2 space-y-0.5 text-sm">
              <div className="flex justify-between text-muted">
                <span>Ara toplam</span>
                <span>{money(runningSubtotal, currency)}</span>
              </div>
              {discountTotal > 0 && (
                <div className="flex justify-between text-brand-600">
                  <span>İndirim</span>
                  <span>− {money(discountTotal, currency)}</span>
                </div>
              )}
              {Number(order?.tip_total ?? 0) > 0 && (
                <div className="flex justify-between text-muted">
                  <span>Bahşiş</span>
                  <span>{money(order.tip_total, currency)}</span>
                </div>
              )}
              {Number(order?.tax_total ?? 0) > 0 && (
                <div className="flex justify-between text-muted">
                  <span>Servis</span>
                  <span>{money(order.tax_total, currency)}</span>
                </div>
              )}
              {order?.charged_to_room && (
                <div className="flex justify-between font-semibold text-amber-600">
                  <span>🧾 Odaya yazıldı</span>
                  <span></span>
                </div>
              )}
              <div className="flex justify-between pt-0.5 text-lg font-black text-ink">
                <span>Toplam</span>
                <span>{money(grandTotal, currency)}</span>
              </div>
            </div>
            {error && <p className="mb-2 text-xs text-red-600">{error}</p>}

            {order && (
              <div className="mb-2 text-xs">
                {Number(order.tax_total) > 0 ? (
                  <button onClick={() => applyServiceCharge(0)} className="font-medium text-muted hover:underline">
                    ✕ Servis ücretini kaldır
                  </button>
                ) : (
                  <button onClick={() => applyServiceCharge(10)} className="font-semibold text-brand-600 hover:underline">
                    + Servis ücreti %10
                  </button>
                )}
              </div>
            )}

            <div className="mb-2 grid grid-cols-3 gap-1.5">
              <MiniBtn onClick={onPark} disabled={busy || (cartLines.length === 0 && !order)}>
                ⏸ Beklet
              </MiniBtn>
              <MiniBtn onClick={onDiscount} disabled={busy || (committedItems.length === 0 && cartLines.length === 0)}>
                % İndirim
              </MiniBtn>
              <MiniBtn onClick={onSendToKitchen} disabled={busy || cartLines.length === 0}>
                🍳 Mutfak
              </MiniBtn>
            </div>
            {order && Number(order.paid_total) > 0 && (
              <button
                onClick={() => setRefundOrder(order)}
                className="mb-2 w-full rounded-xl border border-red-200 bg-red-50 py-2.5 text-sm font-semibold text-red-600 transition hover:bg-red-100"
              >
                ↩ İade · {money(order.paid_total, currency)} tahsil edildi
              </button>
            )}
            <button
              onClick={onPay}
              disabled={busy || (grandTotal <= 0 && committedItems.length === 0)}
              className="w-full rounded-xl bg-brand-500 py-4 text-base font-bold text-white shadow-sm transition hover:bg-brand-600 disabled:opacity-50"
            >
              {busy ? 'İşleniyor…' : `ÖDE · ${money(grandTotal, currency)}`}
            </button>
          </div>
        </aside>
      </div>

      {/* Modals */}
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
      {showMap && (
        <TableMapModal
          tables={tables}
          onClose={() => setShowMap(false)}
          onPick={(id) => {
            setShowMap(false);
            if (id === null) {
              setOrderType('takeaway');
              setTableId(null);
              setTableCode(null);
            } else {
              setOrderType('table');
              setTableId(id);
              setTableCode(tables.find((t) => t.id === id)?.code ?? null);
            }
          }}
        />
      )}
      {showDiscount && order && (
        <DiscountModal
          subtotal={Number(order.subtotal)}
          currency={currency}
          onClose={() => setShowDiscount(false)}
          onApply={applyDiscount}
        />
      )}
      {lineDisc && order && (
        <DiscountModal
          subtotal={Number(lineDisc.unit_price) * lineDisc.quantity}
          currency={currency}
          onClose={() => setLineDisc(null)}
          onApply={async (type, value) => {
            const item = lineDisc;
            setLineDisc(null);
            try {
              setOrder(await api.posLineDiscount(order.id, item.id, { type, value }));
            } catch (e: any) {
              setError(e?.message ?? 'Satır indirimi uygulanamadı.');
            }
          }}
        />
      )}
      {payOrder && (
        <PaymentModal
          order={payOrder}
          currency={currency}
          canRoomCharge={canRoomCharge}
          api={api}
          onClose={() => setPayOrder(null)}
          onDone={onPaid}
        />
      )}
      {showRecall && (
        <RecallDrawer
          orders={recallOrders}
          currency={currency}
          scope={recallScope}
          onScope={loadRecall}
          onClose={() => setShowRecall(false)}
          onPick={pickRecalled}
        />
      )}
      {refundOrder && (
        <RefundModal
          order={refundOrder}
          currency={currency}
          api={api}
          onClose={() => setRefundOrder(null)}
          onDone={(res) => {
            setRefundOrder(null);
            setOrder(res);
            load();
          }}
        />
      )}
      {showKds && (
        <KdsPanel branchId={activeBranch} api={api} productName={productName} onClose={() => setShowKds(false)} />
      )}
      {showShift && (
        <ShiftModal
          shift={shift}
          api={api}
          branchId={activeBranch}
          currency={currency}
          onClose={() => setShowShift(false)}
          onChange={(s) => setShift(s)}
        />
      )}
      {receipt && (
        <Modal title="Ödeme Tamamlandı ✓" onClose={() => { setReceipt(null); resetTicket(); }}>
          <div className="mb-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-center">
            <div className="text-4xl">✅</div>
            <div className="mt-2 text-2xl font-black text-ink">{money(receipt.grand_total, currency)}</div>
            <div className="text-sm text-muted">Adisyon #{receipt.id} kapatıldı</div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => printReceipt(receipt, venueName, currency)}
              className="rounded-xl border border-line py-3 text-sm font-semibold text-ink hover:bg-canvas"
            >
              🖨️ Fiş Yazdır
            </button>
            <button
              onClick={() => { setReceipt(null); resetTicket(); }}
              className="rounded-xl bg-brand-500 py-3 text-sm font-semibold text-white hover:bg-brand-600"
            >
              + Yeni Sipariş
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function CatPill({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`shrink-0 whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-semibold transition ${
        active ? 'bg-brand-500 text-white' : 'border border-line bg-surface text-muted hover:border-brand-300'
      }`}
    >
      {children}
    </button>
  );
}

function SegBtn({ active, onClick, disabled, children }: { active: boolean; onClick: () => void; disabled?: boolean; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`rounded-lg py-2 text-sm font-semibold transition disabled:opacity-40 ${
        active ? 'bg-brand-500 text-white' : 'border border-line bg-surface text-muted'
      }`}
    >
      {children}
    </button>
  );
}

function MiniBtn({ onClick, disabled, children }: { onClick: () => void; disabled?: boolean; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="rounded-lg border border-line bg-surface py-2.5 text-xs font-semibold text-ink transition hover:border-brand-400 disabled:opacity-40"
    >
      {children}
    </button>
  );
}
