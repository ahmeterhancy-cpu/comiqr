'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { BrandLogo } from '@/components/BrandLogo';
import { getActiveBranchId } from '@/lib/branch';
import { createEcho } from '@/lib/echo';
import { clearSession } from '@/lib/auth';
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
  note?: string;
};

const lineKey = (pid: number, vid: number | undefined, mods: number[]) =>
  `${pid}:${vid ?? 0}:${[...mods].sort((a, b) => a - b).join(',')}`;

const productImg = (p: any): string | undefined => p?.images?.[0] ?? p?.image_paths_json?.[0] ?? p?.image_path;

/**
 * Ultra POS (Faz 3) — RestoBit-style three-column terminal: light sidebar +
 * product grid + order panel. Build a ticket from the grid, seat it at a table,
 * add rounds to open tabs, discount, void, and settle via the RestoBit payment
 * sheet (full/split, cash/card/room, quick amounts + keypad) or a printed
 * receipt — plus a cash-drawer shift with a Z-report.
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

  function setLineNote(key: string, text: string) {
    setCart((c) => (c[key] ? { ...c, [key]: { ...c[key], note: text } } : c));
  }
  const [notesOpen, setNotesOpen] = useState<Set<string>>(new Set());
  function toggleNote(key: string) {
    setNotesOpen((s) => {
      const n = new Set(s);
      n.has(key) ? n.delete(key) : n.add(key);
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
    // Fold any per-line notes into the order note (backend has no per-line note).
    const lineNotes = cartLines
      .filter((l) => l.note?.trim())
      .map((l) => `${l.product.name}: ${l.note!.trim()}`);
    const fullNote = [note, ...lineNotes].filter(Boolean).join(' · ') || undefined;
    try {
      const res = order
        ? await api.posAddItems(order.id, items)
        : await api.posOrder({
            table_id: orderType === 'table' && tableId ? tableId : undefined,
            branch_id: activeBranch ?? undefined,
            items,
            note: fullNote,
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
    return <div className="grid h-screen place-items-center bg-[#f4f6f8] text-muted">Yükleniyor…</div>;
  }

  return (
    <div className="flex h-screen overflow-hidden bg-[#f4f6f8] text-ink">
      {/* ---- Sidebar (RestoBit-style, light) ---- */}
      <PosSidebar
        userName={me?.user.name ?? venueName}
        isCashier={isCashier}
        onLogout={() => { clearSession(); router.replace('/pos/login'); }}
      />

      {/* ---- Main column ---- */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Top bar: breadcrumb + actions */}
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line bg-white px-5 py-3">
          <div>
            <h1 className="text-lg font-extrabold tracking-tight text-ink">Point of Sale (POS)</h1>
            <div className="text-[11px] font-medium text-muted">{venueName} · {now.toLocaleTimeString('tr-TR')}</div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setShowShift(true)}
              className={`rounded-lg px-3 py-2 text-xs font-semibold transition ${
                shift ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200' : 'bg-canvas text-muted hover:bg-line/40'
              }`}
            >
              {shift ? `🟢 ${money(shift.expected_cash, currency)}` : '🔒 Kasa Kapalı'}
            </button>
            <TopBtn onClick={resetTicket}><span className="text-brand-600">＋</span> Yeni</TopBtn>
            <TopBtn onClick={() => loadRecall('today')}>
              ▤ QR Siparişleri
              {liveAlert && <span className="ml-1 inline-block h-2 w-2 rounded-full bg-red-500 align-middle" />}
            </TopBtn>
            <TopBtn onClick={() => loadRecall('open')}>❏ Taslak Listesi</TopBtn>
            <TopBtn onClick={() => !order && setShowMap(true)}>🍽️ Masa Siparişi</TopBtn>
            {!isCashier && (
              <>
                <TopBtn onClick={() => setShowKds(true)}>🍳 Mutfak</TopBtn>
                <TopBtn onClick={() => router.push('/dashboard')}>← Panel</TopBtn>
              </>
            )}
          </div>
        </header>

        <div className="flex min-h-0 flex-1 gap-4 overflow-hidden p-4">
        {/* ---- Products ---- */}
        <section className="flex min-w-0 flex-1 flex-col overflow-hidden rounded-2xl border border-line bg-white">
          <div className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-3">
            <div className="relative min-w-[180px] flex-1">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted">🔍</span>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Ürün ara…"
                className="w-full rounded-lg border border-line bg-canvas py-2 pl-9 pr-3 text-sm outline-none focus:border-brand-500"
              />
            </div>
            <select
              value={favView ? 'fav' : activeCat ?? ''}
              onChange={(e) => {
                const v = e.target.value;
                if (v === 'fav') setFavView(true);
                else { setFavView(false); setActiveCat(v ? Number(v) : null); }
              }}
              className="rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink outline-none"
            >
              <option value="">Tüm Kategoriler</option>
              {favorites.length > 0 && <option value="fav">⭐ Sık kullanılan</option>}
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          {/* Category pills */}
          <div className="flex gap-1.5 overflow-x-auto border-b border-line px-4 py-2.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {favorites.length > 0 && (
              <CatPill active={favView} onClick={() => setFavView(true)}>⭐ Sık</CatPill>
            )}
            <CatPill active={!favView && activeCat === null} onClick={() => { setFavView(false); setActiveCat(null); }}>Tümü</CatPill>
            {categories.map((c) => (
              <CatPill key={c.id} active={!favView && activeCat === c.id} onClick={() => { setFavView(false); setActiveCat(c.id); }}>{c.name}</CatPill>
            ))}
          </div>

          {/* Grid */}
          <div className="grid flex-1 auto-rows-min grid-cols-2 gap-3 overflow-y-auto p-4 sm:grid-cols-3 lg:grid-cols-4">
            {shown.map((p) => (
              <button
                key={p.id}
                onClick={() => pick(p)}
                className="flex flex-col overflow-hidden rounded-2xl border border-line bg-white text-left transition hover:-translate-y-0.5 hover:shadow-md active:scale-[0.98]"
              >
                <div className="relative aspect-square w-full bg-canvas">
                  {productImg(p) ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={productImg(p)} alt={p.name} className="h-full w-full object-cover" />
                  ) : (
                    <div className="grid h-full w-full place-items-center text-2xl font-black text-line">{p.name.slice(0, 2)}</div>
                  )}
                  {p.age_restricted && (
                    <span className="absolute right-2 top-2 rounded bg-red-600 px-1 text-[10px] font-bold text-white">18+</span>
                  )}
                  <span
                    onClick={(e) => { e.stopPropagation(); toggleFav(p.id); }}
                    className="absolute left-2 top-2 cursor-pointer rounded-full bg-white/85 px-1 text-sm leading-none shadow-sm"
                  >
                    {favorites.includes(p.id) ? '⭐' : '☆'}
                  </span>
                </div>
                <div className="flex flex-1 flex-col p-2.5">
                  <div className="line-clamp-2 text-xs font-semibold leading-tight text-ink">{p.name}</div>
                  <div className="mt-auto flex items-center justify-between pt-1.5">
                    <span className="text-sm font-bold text-brand-600">{money(p.price, currency)}</span>
                    <span
                      className="grid h-7 w-7 place-items-center rounded-full bg-brand-500 text-base font-bold leading-none text-white shadow-sm transition group-hover:bg-brand-600"
                      style={{ color: '#ffffff' }}
                    >
                      ＋
                    </span>
                  </div>
                </div>
              </button>
            ))}
            {shown.length === 0 && <p className="col-span-full py-10 text-center text-sm text-muted">Ürün bulunamadı.</p>}
          </div>
        </section>

        {/* ---- Order panel ---- */}
        <aside className="flex w-[360px] shrink-0 flex-col overflow-hidden rounded-2xl border border-line bg-white xl:w-[400px]">
          {/* Search existing + order context */}
          <div className="space-y-2.5 border-b border-line p-3">
            <button
              onClick={() => loadRecall('open')}
              className="flex w-full items-center gap-2 rounded-lg border border-line bg-canvas px-3 py-2 text-left text-sm text-muted transition hover:border-brand-400"
            >
              🔍 Mevcut siparişlerde ara
            </button>
            <div className="grid grid-cols-2 gap-2">
              <select
                value={orderType}
                disabled={!!order}
                onChange={(e) => {
                  const v = e.target.value as 'table' | 'takeaway';
                  setOrderType(v);
                  if (v === 'takeaway') { setTableId(null); setTableCode(null); }
                }}
                className="rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink outline-none disabled:opacity-60"
              >
                <option value="table">🍽️ Masa Servisi</option>
                <option value="takeaway">🛍️ Gel-Al</option>
              </select>
              <button
                onClick={() => !order && orderType === 'table' && setShowMap(true)}
                disabled={!!order || orderType !== 'table'}
                className="truncate rounded-lg border border-line bg-white px-3 py-2 text-left text-sm text-ink outline-none transition hover:border-brand-400 disabled:opacity-60"
              >
                {tableCode ? `${tableCode} ✎` : 'Masa Seç →'}
              </button>
            </div>
            <div className="flex items-center justify-between pt-0.5">
              <span className="flex items-center gap-1.5 text-sm font-bold text-ink">
                🧾 {order ? `Sipariş #${order.id}` : 'Yeni Sipariş'}
              </span>
              {order && (
                <button onClick={resetTicket} className="text-xs font-semibold text-brand-600 hover:underline">+ Yeni</button>
              )}
            </div>
          </div>

          {/* Lines */}
          <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3">
            {committedItems.length === 0 && cartLines.length === 0 ? (
              <p className="py-12 text-center text-sm text-muted">Ürün ekleyin…</p>
            ) : (
              <>
                {committedItems.map((i: any) => (
                  <div key={`c${i.id}`} className="rounded-xl border border-line bg-white p-2.5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold text-ink">{i.product_name ?? productName(i.product_id)}</div>
                        {(i.modifiers ?? []).length > 0 && (
                          <div className="truncate text-[11px] text-muted">{i.modifiers.map((m: any) => m.name).join(' · ')}</div>
                        )}
                        <div className="mt-0.5 text-xs text-brand-600">
                          {money(i.unit_price, currency)} × {i.quantity} = <b>{money(i.line_total, currency)}</b>
                          {Number(i.discount_total) > 0 && <span className="ml-1 text-[10px] text-emerald-600">✓ indirim</span>}
                        </div>
                      </div>
                      {order?.payment_status !== 'paid' && (
                        <button onClick={() => voidCommitted(i.id)} title="Çıkar" className="grid h-6 w-6 shrink-0 place-items-center rounded-md bg-red-50 text-red-500 hover:bg-red-100">🗑</button>
                      )}
                    </div>
                    <div className="mt-1.5 flex items-center justify-between">
                      <span className="text-[10px] font-semibold uppercase text-emerald-600">✓ mutfağa gönderildi</span>
                      {order?.payment_status !== 'paid' && (
                        <button onClick={() => setLineDisc(i)} className="rounded-md border border-line px-2 py-0.5 text-[11px] font-medium text-muted hover:border-brand-300">% indir</button>
                      )}
                    </div>
                  </div>
                ))}
                {cartLines.map((l) => (
                  <div key={l.key} className="rounded-xl border border-brand-200 bg-brand-50/40 p-2.5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold text-ink">{l.product.name}</div>
                        {(l.variantName || l.modifierNames.length > 0) && (
                          <div className="truncate text-[11px] text-muted">{[l.variantName, ...l.modifierNames].filter(Boolean).join(' · ')}</div>
                        )}
                        <div className="mt-0.5 text-xs text-brand-600">{money(l.unitPrice, currency)} × {l.qty} = <b>{money(l.unitPrice * l.qty, currency)}</b></div>
                      </div>
                      <button onClick={() => setQty(l.key, 0)} title="Kaldır" className="grid h-6 w-6 shrink-0 place-items-center rounded-md bg-red-50 text-red-500 hover:bg-red-100">🗑</button>
                    </div>
                    <div className="mt-1.5 flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <button onClick={() => setQty(l.key, l.qty - 1)} className="grid h-6 w-6 place-items-center rounded-md bg-white text-ink shadow-sm">−</button>
                        <span className="w-5 text-center text-sm font-bold text-ink">{l.qty}</span>
                        <button onClick={() => setQty(l.key, l.qty + 1)} className="grid h-6 w-6 place-items-center rounded-md bg-white text-ink shadow-sm">+</button>
                      </div>
                      <button onClick={() => toggleNote(l.key)} className="rounded-md border border-line bg-white px-2 py-0.5 text-[11px] font-medium text-muted hover:border-brand-300">📝 Not Ekle</button>
                    </div>
                    {notesOpen.has(l.key) && (
                      <input
                        value={l.note ?? ''}
                        onChange={(e) => setLineNote(l.key, e.target.value)}
                        placeholder="Bu ürün için not…"
                        className="mt-1.5 w-full rounded-md border border-line px-2 py-1 text-xs outline-none focus:border-brand-500"
                      />
                    )}
                  </div>
                ))}
              </>
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
            <div className="mb-3 space-y-1.5 text-sm">
              <div className="flex justify-between text-muted">
                <span>Ara toplam</span>
                <span className="font-semibold text-ink">{money(runningSubtotal, currency)}</span>
              </div>
              <button
                onClick={onDiscount}
                disabled={busy || (committedItems.length === 0 && cartLines.length === 0)}
                className="flex w-full items-center justify-between text-muted transition hover:text-brand-600 disabled:opacity-60"
              >
                <span>İndirim ✎</span>
                <span className={discountTotal > 0 ? 'font-semibold text-brand-600' : ''}>
                  {discountTotal > 0 ? `− ${money(discountTotal, currency)}` : money(0, currency)}
                </span>
              </button>
              {Number(order?.tip_total ?? 0) > 0 && (
                <div className="flex justify-between text-muted"><span>Bahşiş</span><span>{money(order.tip_total, currency)}</span></div>
              )}
              {Number(order?.tax_total ?? 0) > 0 && (
                <div className="flex justify-between text-muted"><span>Servis</span><span>{money(order.tax_total, currency)}</span></div>
              )}
              {order?.charged_to_room && (
                <div className="flex justify-between font-semibold text-amber-600"><span>🧾 Odaya yazıldı</span><span></span></div>
              )}
              <div className="flex justify-between border-t border-line pt-1.5 text-lg font-black text-ink">
                <span>Toplam</span>
                <span>{money(grandTotal, currency)}</span>
              </div>
            </div>
            {error && <p className="mb-2 text-xs text-red-600">{error}</p>}

            {order && (
              <div className="mb-2 text-xs">
                {Number(order.tax_total) > 0 ? (
                  <button onClick={() => applyServiceCharge(0)} className="font-medium text-muted hover:underline">✕ Servis ücretini kaldır</button>
                ) : (
                  <button onClick={() => applyServiceCharge(10)} className="font-semibold text-brand-600 hover:underline">+ Servis ücreti %10</button>
                )}
              </div>
            )}
            {order && Number(order.paid_total) > 0 && (
              <button
                onClick={() => setRefundOrder(order)}
                className="mb-2 w-full rounded-xl border border-red-200 bg-red-50 py-2 text-sm font-semibold text-red-600 transition hover:bg-red-100"
              >
                ↩ İade · {money(order.paid_total, currency)} tahsil edildi
              </button>
            )}

            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={onSendToKitchen}
                disabled={busy || cartLines.length === 0}
                className="rounded-xl bg-slate-900 py-3 text-sm font-bold text-white transition hover:bg-slate-800 disabled:opacity-40"
                style={{ color: '#ffffff' }}
              >
                🍳 KOT & Yazdır
              </button>
              <button
                onClick={onPark}
                disabled={busy || (cartLines.length === 0 && !order)}
                className="rounded-xl border border-line bg-white py-3 text-sm font-bold text-ink transition hover:bg-canvas disabled:opacity-40"
              >
                ❏ Taslak
              </button>
              <button
                onClick={onPay}
                disabled={busy || (grandTotal <= 0 && committedItems.length === 0)}
                className="rounded-xl bg-brand-500 py-3 text-sm font-bold text-white transition hover:bg-brand-600 disabled:opacity-40"
                style={{ color: '#ffffff' }}
              >
                {busy ? '…' : '💳 Öde'}
              </button>
              <button
                onClick={onPay}
                disabled={busy || (grandTotal <= 0 && committedItems.length === 0)}
                className="rounded-xl bg-emerald-500 py-3 text-sm font-bold text-white transition hover:bg-emerald-600 disabled:opacity-40"
                style={{ color: '#ffffff' }}
              >
                🖨️ Fiş & Öde
              </button>
            </div>
          </div>
        </aside>
        </div>
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

function TopBtn({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className="rounded-lg border border-line bg-white px-3 py-2 text-xs font-semibold text-ink transition hover:border-brand-400 hover:text-brand-600"
    >
      {children}
    </button>
  );
}

const POS_NAV: { href: string; label: string; icon: string }[] = [
  { href: '/dashboard', label: 'Panel', icon: '▤' },
  { href: '/pos', label: 'POS', icon: '🧾' },
  { href: '/menu', label: 'Menü', icon: '📋' },
  { href: '/tables', label: 'Masalar', icon: '🍽️' },
  { href: '/orders', label: 'Siparişler', icon: '📦' },
  { href: '/customers', label: 'Müşteriler', icon: '👤' },
  { href: '/reports', label: 'Raporlar', icon: '📊' },
  { href: '/settings', label: 'Ayarlar', icon: '⚙️' },
];

function PosSidebar({ userName, isCashier, onLogout }: { userName: string; isCashier: boolean; onLogout: () => void }) {
  return (
    <aside className="hidden w-56 shrink-0 flex-col border-r border-line bg-white p-4 lg:flex xl:w-60">
      <div className="px-1">
        <BrandLogo className="h-8 w-auto" />
      </div>
      <div className="mt-5 flex items-center gap-2.5 rounded-xl bg-canvas px-3 py-2.5">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-brand-500 text-sm font-bold text-white" style={{ color: '#ffffff' }}>
          {(userName || 'K').charAt(0).toUpperCase()}
        </span>
        <div className="min-w-0">
          <div className="truncate text-sm font-bold text-ink">{userName}</div>
          <div className="text-[11px] text-muted">{isCashier ? 'Kasa' : 'Yönetim'}</div>
        </div>
      </div>
      <nav className="mt-5 flex-1 space-y-1 overflow-y-auto">
        {(isCashier ? POS_NAV.filter((n) => n.href === '/pos') : POS_NAV).map((n) => {
          const active = n.href === '/pos';
          return (
            <Link
              key={n.href}
              href={n.href}
              className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold transition ${
                active ? 'bg-brand-50 text-brand-700' : 'text-muted hover:bg-canvas hover:text-ink'
              }`}
            >
              <span className="w-5 text-center">{n.icon}</span>
              {n.label}
            </Link>
          );
        })}
      </nav>
      <button
        onClick={onLogout}
        className="mt-2 flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold text-muted transition hover:bg-canvas hover:text-red-600"
      >
        <span className="w-5 text-center">⎋</span> Çıkış
      </button>
    </aside>
  );
}
