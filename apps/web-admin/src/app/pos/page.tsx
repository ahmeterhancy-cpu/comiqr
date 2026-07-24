'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
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
import { CustomersView, OrdersView, ReportsView, SummaryView, TablesView } from '@/components/pos-views';

type PosView = 'sale' | 'summary' | 'orders' | 'tables' | 'customers' | 'reports';

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
  const t = useTranslations('pos');
  const c = useTranslations('common');
  const router = useRouter();
  const { api, me, ready } = useApi('/pos/login');
  const isCashier = me?.user.role === 'cashier';
  const isWaiter = me?.user.role === 'waiter';
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
  const [view, setView] = useState<PosView>('sale');

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
    // Fail soft: a transient 403/network error (or a tenant-less session) must not
    // crash the terminal — the views just stay empty and the guard redirects if needed.
    const [ps, cs, ts, bs] = await Promise.all([
      api.adminProducts().catch(() => [] as any[]),
      api.adminCategories().catch(() => [] as any[]),
      api.adminTables().catch(() => [] as any[]),
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

  // Deep-link from the waiter app: /pos?table=<id> seats that table and jumps to
  // the sale view so the waiter can build the ticket at once. If the table already
  // has an open tab, recall it (adding a round via posAddItems) instead of seating
  // a fresh ticket — a plain place() would create a duplicate order on the session.
  const seatedFromUrl = useRef(false);
  useEffect(() => {
    if (seatedFromUrl.current || tables.length === 0) return;
    const raw = new URLSearchParams(window.location.search).get('table');
    seatedFromUrl.current = true;
    window.history.replaceState(null, '', '/pos'); // don't re-seat on refresh
    if (!raw) return;
    const tb = tables.find((x) => x.id === Number(raw));
    if (!tb) return;
    (async () => {
      try {
        const open = await api.posOrders({ scope: 'open', branch_id: activeBranch ?? undefined });
        const existing = open.find((o: any) => o.table_code === tb.code);
        if (existing) {
          pickRecalled(existing);
          setView('sale');
          return;
        }
      } catch {
        /* fall through to a fresh ticket */
      }
      resetTicket();
      setOrderType('table');
      setTableId(tb.id);
      setTableCode(tb.code);
      setView('sale');
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tables, activeBranch]);

  // The POS is tenant-scoped — a superadmin (no tenant) can't operate the terminal.
  useEffect(() => {
    if (ready && me && !me.tenant) router.replace('/superadmin');
  }, [ready, me, router]);

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
      setError(e?.message ?? t('orderSaveFailed'));
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
      setError(e?.message ?? t('discountFailed'));
    }
  }

  async function applyServiceCharge(percent: number) {
    if (!order) return;
    try {
      setOrder(await api.posServiceCharge(order.id, percent));
    } catch (e: any) {
      setError(e?.message ?? t('serviceChargeFailed'));
    }
  }

  async function voidCommitted(itemId: number) {
    if (!order) return;
    try {
      const res = await api.posVoidItem(order.id, itemId);
      setOrder(res);
    } catch (e: any) {
      setError(e?.message ?? t('itemVoidFailed'));
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
      setError(t('tabsLoadFailed'));
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
    return <div className="grid h-screen place-items-center bg-[#f4f6f8] text-muted">{c('loading')}</div>;
  }

  return (
    <div className="flex h-screen overflow-hidden bg-[#f4f6f8] text-ink">
      {/* ---- Sidebar (RestoBit-style, light) — POS-only nav ---- */}
      <PosSidebar
        userName={me?.user.name ?? venueName}
        isCashier={isCashier}
        view={view}
        onView={setView}
        shiftOpen={!!shift}
        onKds={() => setShowKds(true)}
        onShift={() => setShowShift(true)}
        onLogout={() => { clearSession(); router.replace('/pos/login'); }}
      />

      {/* ---- Main column ---- */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Top bar: breadcrumb + actions */}
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line bg-white px-5 py-3">
          <div>
            <h1 className="text-lg font-extrabold tracking-tight text-ink">{t('title')}</h1>
            <div className="text-[11px] font-medium text-muted">{venueName} · {now.toLocaleTimeString('tr-TR')}</div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setShowShift(true)}
              className={`rounded-lg px-3 py-2 text-xs font-semibold transition ${
                shift ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200' : 'bg-canvas text-muted hover:bg-line/40'
              }`}
            >
              {shift ? `🟢 ${money(shift.expected_cash, currency)}` : `🔒 ${t('drawerClosed')}`}
            </button>
            <TopBtn onClick={resetTicket}><span className="text-brand-600">＋</span> {t('newTicket')}</TopBtn>
            <TopBtn onClick={() => loadRecall('today')}>
              ▤ {t('qrOrders')}
              {liveAlert && <span className="ml-1 inline-block h-2 w-2 rounded-full bg-red-500 align-middle" />}
            </TopBtn>
            <TopBtn onClick={() => loadRecall('open')}>❏ {t('draftList')}</TopBtn>
            <TopBtn onClick={() => !order && setShowMap(true)}>🍽️ {t('tableOrder')}</TopBtn>
            {isWaiter ? (
              <TopBtn onClick={() => router.push('/waiter')}>← {t('backToWaiter')}</TopBtn>
            ) : !isCashier ? (
              <>
                <TopBtn onClick={() => setShowKds(true)}>🍳 {t('kitchen')}</TopBtn>
                <TopBtn onClick={() => router.push('/dashboard')}>← {t('panel')}</TopBtn>
              </>
            ) : null}
          </div>
        </header>

        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden p-4 lg:flex-row">
        {view === 'sale' ? (
        <>
        {/* ---- Products ---- */}
        <section className="flex min-w-0 flex-1 flex-col overflow-hidden rounded-2xl border border-line bg-white">
          <div className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-3">
            <div className="relative min-w-[180px] flex-1">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted">🔍</span>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t('searchProduct')}
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
              <option value="">{t('allCategories')}</option>
              {favorites.length > 0 && <option value="fav">⭐ {t('favorites')}</option>}
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          {/* Category pills — auto-wrap into as many rows as needed, no scroll */}
          <div className="flex flex-wrap gap-2 border-b border-line px-4 py-2.5">
            {favorites.length > 0 && (
              <CatPill active={favView} onClick={() => setFavView(true)}>⭐ {t('favShort')}</CatPill>
            )}
            <CatPill active={!favView && activeCat === null} onClick={() => { setFavView(false); setActiveCat(null); }}>{c('all')}</CatPill>
            {categories.map((c) => (
              <CatPill key={c.id} active={!favView && activeCat === c.id} img={c.image_path} onClick={() => { setFavView(false); setActiveCat(c.id); }}>{c.name}</CatPill>
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
            {shown.length === 0 && <p className="col-span-full py-10 text-center text-sm text-muted">{t('noProducts')}</p>}
          </div>
        </section>

        {/* ---- Order panel ---- */}
        <aside className="flex max-h-[46vh] w-full shrink-0 flex-col overflow-hidden rounded-2xl border border-line bg-white lg:max-h-none lg:w-[360px] xl:w-[400px]">
          {/* Search existing + order context */}
          <div className="space-y-2.5 border-b border-line p-3">
            <button
              onClick={() => loadRecall('open')}
              className="flex w-full items-center gap-2 rounded-lg border border-line bg-canvas px-3 py-2 text-left text-sm text-muted transition hover:border-brand-400"
            >
              🔍 {t('searchExistingOrders')}
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
                <option value="table">🍽️ {t('dineIn')}</option>
                <option value="takeaway">🛍️ {t('takeaway')}</option>
              </select>
              <button
                onClick={() => !order && orderType === 'table' && setShowMap(true)}
                disabled={!!order || orderType !== 'table'}
                className="truncate rounded-lg border border-line bg-white px-3 py-2 text-left text-sm text-ink outline-none transition hover:border-brand-400 disabled:opacity-60"
              >
                {tableCode ? `${tableCode} ✎` : `${t('selectTable')} →`}
              </button>
            </div>
            <div className="flex items-center justify-between pt-0.5">
              <span className="flex items-center gap-1.5 text-sm font-bold text-ink">
                🧾 {order ? t('orderNo', { id: order.id }) : t('newOrder')}
              </span>
              {order && (
                <button onClick={resetTicket} className="text-xs font-semibold text-brand-600 hover:underline">+ {t('newTicket')}</button>
              )}
            </div>
          </div>

          {/* Lines */}
          <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3">
            {committedItems.length === 0 && cartLines.length === 0 ? (
              <p className="py-12 text-center text-sm text-muted">{t('addProducts')}</p>
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
                          {Number(i.discount_total) > 0 && <span className="ml-1 text-[10px] text-emerald-600">✓ {t('discountTag')}</span>}
                        </div>
                      </div>
                      {order?.payment_status !== 'paid' && (
                        <button onClick={() => voidCommitted(i.id)} title={t('voidItem')} className="grid h-6 w-6 shrink-0 place-items-center rounded-md bg-red-50 text-red-500 hover:bg-red-100">🗑</button>
                      )}
                    </div>
                    <div className="mt-1.5 flex items-center justify-between">
                      <span className="text-[10px] font-semibold uppercase text-emerald-600">✓ {t('sentToKitchen')}</span>
                      {order?.payment_status !== 'paid' && (
                        <button onClick={() => setLineDisc(i)} className="rounded-md border border-line px-2 py-0.5 text-[11px] font-medium text-muted hover:border-brand-300">{t('lineDiscount')}</button>
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
                      <button onClick={() => setQty(l.key, 0)} title={c('remove')} className="grid h-6 w-6 shrink-0 place-items-center rounded-md bg-red-50 text-red-500 hover:bg-red-100">🗑</button>
                    </div>
                    <div className="mt-1.5 flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <button onClick={() => setQty(l.key, l.qty - 1)} className="grid h-6 w-6 place-items-center rounded-md bg-white text-ink shadow-sm">−</button>
                        <span className="w-5 text-center text-sm font-bold text-ink">{l.qty}</span>
                        <button onClick={() => setQty(l.key, l.qty + 1)} className="grid h-6 w-6 place-items-center rounded-md bg-white text-ink shadow-sm">+</button>
                      </div>
                      <button onClick={() => toggleNote(l.key)} className="rounded-md border border-line bg-white px-2 py-0.5 text-[11px] font-medium text-muted hover:border-brand-300">📝 {t('addNote')}</button>
                    </div>
                    {notesOpen.has(l.key) && (
                      <input
                        value={l.note ?? ''}
                        onChange={(e) => setLineNote(l.key, e.target.value)}
                        placeholder={t('itemNote')}
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
                placeholder={t('orderNote')}
                className="mb-2 w-full rounded-lg border border-line px-3 py-2 text-sm outline-none focus:border-brand-500"
              />
            )}
            <div className="mb-3 space-y-1.5 text-sm">
              <div className="flex justify-between text-muted">
                <span>{t('subtotal')}</span>
                <span className="font-semibold text-ink">{money(runningSubtotal, currency)}</span>
              </div>
              <button
                onClick={onDiscount}
                disabled={busy || (committedItems.length === 0 && cartLines.length === 0)}
                className="flex w-full items-center justify-between text-muted transition hover:text-brand-600 disabled:opacity-60"
              >
                <span>{t('discount')} ✎</span>
                <span className={discountTotal > 0 ? 'font-semibold text-brand-600' : ''}>
                  {discountTotal > 0 ? `− ${money(discountTotal, currency)}` : money(0, currency)}
                </span>
              </button>
              {Number(order?.tip_total ?? 0) > 0 && (
                <div className="flex justify-between text-muted"><span>{t('tip')}</span><span>{money(order.tip_total, currency)}</span></div>
              )}
              {Number(order?.tax_total ?? 0) > 0 && (
                <div className="flex justify-between text-muted"><span>{t('service')}</span><span>{money(order.tax_total, currency)}</span></div>
              )}
              {order?.charged_to_room && (
                <div className="flex justify-between font-semibold text-amber-600"><span>🧾 {t('chargedToRoom')}</span><span></span></div>
              )}
              <div className="flex justify-between border-t border-line pt-1.5 text-lg font-black text-ink">
                <span>{c('total')}</span>
                <span>{money(grandTotal, currency)}</span>
              </div>
            </div>
            {error && <p className="mb-2 text-xs text-red-600">{error}</p>}

            {order && (
              <div className="mb-2 text-xs">
                {Number(order.tax_total) > 0 ? (
                  <button onClick={() => applyServiceCharge(0)} className="font-medium text-muted hover:underline">✕ {t('removeServiceCharge')}</button>
                ) : (
                  <button onClick={() => applyServiceCharge(10)} className="font-semibold text-brand-600 hover:underline">+ {t('serviceCharge10')}</button>
                )}
              </div>
            )}
            {order && Number(order.paid_total) > 0 && (
              <button
                onClick={() => setRefundOrder(order)}
                className="mb-2 w-full rounded-xl border border-red-200 bg-red-50 py-2 text-sm font-semibold text-red-600 transition hover:bg-red-100"
              >
                ↩ {t('refundCollected', { amount: money(order.paid_total, currency) })}
              </button>
            )}

            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={onSendToKitchen}
                disabled={busy || cartLines.length === 0}
                className="rounded-xl bg-slate-900 py-3 text-sm font-bold text-white transition hover:bg-slate-800 disabled:opacity-40"
                style={{ color: '#ffffff' }}
              >
                🍳 {t('kotPrint')}
              </button>
              <button
                onClick={onPark}
                disabled={busy || (cartLines.length === 0 && !order)}
                className="rounded-xl border border-line bg-white py-3 text-sm font-bold text-ink transition hover:bg-canvas disabled:opacity-40"
              >
                ❏ {t('draft')}
              </button>
              <button
                onClick={onPay}
                disabled={busy || (grandTotal <= 0 && committedItems.length === 0)}
                className="rounded-xl bg-brand-500 py-3 text-sm font-bold text-white transition hover:bg-brand-600 disabled:opacity-40"
                style={{ color: '#ffffff' }}
              >
                {busy ? '…' : `💳 ${t('pay')}`}
              </button>
              <button
                onClick={onPay}
                disabled={busy || (grandTotal <= 0 && committedItems.length === 0)}
                className="rounded-xl bg-emerald-500 py-3 text-sm font-bold text-white transition hover:bg-emerald-600 disabled:opacity-40"
                style={{ color: '#ffffff' }}
              >
                🖨️ {t('receiptPay')}
              </button>
            </div>
          </div>
        </aside>
        </>
        ) : view === 'summary' ? (
          <SummaryView api={api} currency={currency} branchId={activeBranch} onNewSale={() => { resetTicket(); setView('sale'); }} onOpenShift={() => setShowShift(true)} />
        ) : view === 'orders' ? (
          <OrdersView api={api} currency={currency} branchId={activeBranch} onRecall={(o) => { pickRecalled(o); setView('sale'); }} />
        ) : view === 'tables' ? (
          <TablesView api={api} tables={tables} currency={currency} branchId={activeBranch} onPickTable={(id, code) => { resetTicket(); setOrderType('table'); setTableId(id); setTableCode(code); setView('sale'); }} onRecall={(o) => { pickRecalled(o); setView('sale'); }} />
        ) : view === 'customers' ? (
          <CustomersView api={api} currency={currency} />
        ) : (
          <ReportsView api={api} currency={currency} branchId={activeBranch} />
        )}
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
              setError(e?.message ?? t('lineDiscountFailed'));
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
        <Modal title={`${t('paymentComplete')} ✓`} onClose={() => { setReceipt(null); resetTicket(); }}>
          <div className="mb-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-center">
            <div className="text-4xl">✅</div>
            <div className="mt-2 text-2xl font-black text-ink">{money(receipt.grand_total, currency)}</div>
            <div className="text-sm text-muted">{t('tabClosed', { id: receipt.id })}</div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => printReceipt(receipt, venueName, currency, {
                receiptWord: t('receiptWord'),
                subtotal: t('subtotal'),
                discount: t('discount'),
                tip: t('tip'),
                total: t('totalReceipt'),
                thanks: t('thanks'),
              })}
              className="rounded-xl border border-line py-3 text-sm font-semibold text-ink hover:bg-canvas"
            >
              🖨️ {t('printReceipt')}
            </button>
            <button
              onClick={() => { setReceipt(null); resetTicket(); }}
              className="rounded-xl bg-brand-500 py-3 text-sm font-semibold text-white hover:bg-brand-600"
            >
              + {t('newOrder')}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function CatPill({ active, onClick, img, children }: { active: boolean; onClick: () => void; img?: string | null; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`flex shrink-0 items-center gap-2.5 whitespace-nowrap rounded-2xl text-sm font-semibold transition ${
        img ? 'py-1.5 pl-1.5 pr-4' : 'px-5 py-3'
      } ${active ? 'bg-brand-500 text-white shadow-sm' : 'border border-line bg-surface text-muted hover:border-brand-300'}`}
      style={active ? { color: '#ffffff' } : undefined}
    >
      {img && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={img} alt="" className={`h-12 w-12 shrink-0 rounded-xl object-cover ring-1 ${active ? 'ring-white/50' : 'ring-black/5'}`} />
      )}
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

function PosSidebar({
  userName,
  isCashier,
  view,
  onView,
  shiftOpen,
  onKds,
  onShift,
  onLogout,
}: {
  userName: string;
  isCashier: boolean;
  view: PosView;
  onView: (v: PosView) => void;
  shiftOpen: boolean;
  onKds: () => void;
  onShift: () => void;
  onLogout: () => void;
}) {
  const t = useTranslations('pos');
  // POS-only sections — mirrors the admin menu structure but stays in the terminal.
  const views: { key: PosView; label: string; icon: string }[] = [
    { key: 'summary', label: t('summary'), icon: '🏠' },
    { key: 'sale', label: t('sale'), icon: '🧾' },
    { key: 'orders', label: t('orders'), icon: '📋' },
    { key: 'tables', label: t('tables'), icon: '🍽️' },
    { key: 'customers', label: t('customers'), icon: '👤' },
    { key: 'reports', label: t('reports'), icon: '📊' },
  ];
  const actions = [
    ...(isCashier ? [] : [{ key: 'kds', label: t('kitchenKds'), icon: '🍳', onClick: onKds }]),
    { key: 'shift', label: shiftOpen ? t('shiftOpenLabel') : t('shift'), icon: shiftOpen ? '🟢' : '🔒', onClick: onShift },
  ];

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
          <div className="text-[11px] text-muted">{isCashier ? t('cashier') : 'POS'}</div>
        </div>
      </div>
      <div className="mb-1 mt-5 px-3 text-[10px] font-bold uppercase tracking-wide text-muted">{t('posSystem')}</div>
      <nav className="flex-1 space-y-1 overflow-y-auto">
        {views.map((it) => (
          <button
            key={it.key}
            onClick={() => onView(it.key)}
            className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold transition ${
              view === it.key ? 'bg-brand-50 text-brand-700' : 'text-muted hover:bg-canvas hover:text-ink'
            }`}
          >
            <span className="w-5 text-center">{it.icon}</span>
            {it.label}
          </button>
        ))}
        <div className="my-2 border-t border-line" />
        {actions.map((a) => (
          <button
            key={a.key}
            onClick={a.onClick}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold text-muted transition hover:bg-canvas hover:text-ink"
          >
            <span className="w-5 text-center">{a.icon}</span>
            {a.label}
          </button>
        ))}
      </nav>
      <button
        onClick={onLogout}
        className="mt-2 flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold text-muted transition hover:bg-canvas hover:text-red-600"
      >
        <span className="w-5 text-center">⎋</span> {t('logout')}
      </button>
    </aside>
  );
}
