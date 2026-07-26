'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { ApiClient, ApiError } from '@comiqr/shared-types/client';
import type { AllergenRef, Menu, MenuModifierGroup, MenuProduct } from '@comiqr/shared-types';
import { MenuChat } from './menu-chat';

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

export function OrderableMenu({
  menu,
  qrToken,
  tableCode,
  terminalPay = false,
}: {
  menu: Menu;
  qrToken: string;
  tableCode?: string;
  /** Kiosk: pay via the attached physical POS terminal (gateway `terminal`). */
  terminalPay?: boolean;
}) {
  const t = useTranslations('order');
  const mt = useTranslations('menu');
  const locale = useLocale();
  const api = useMemo(() => new ApiClient({ baseUrl: API_URL }), []);

  const allergenMap = useMemo(
    () => new Map<number, AllergenRef>(menu.allergens.map((a) => [a.id, a])),
    [menu.allergens],
  );
  const productNames = useMemo(() => {
    const m = new Map<number, string>();
    for (const c of menu.categories) for (const p of c.products) m.set(p.id, p.name);
    return m;
  }, [menu.categories]);
  const fmt = useMemo(
    () =>
      new Intl.NumberFormat(menu.venue.locale_default ?? 'tr', {
        style: 'currency',
        currency: menu.venue.currency || 'TRY',
        maximumFractionDigits: 0,
      }),
    [menu.venue],
  );
  const categories = useMemo(
    () => menu.categories.filter((c) => c.products.length > 0),
    [menu.categories],
  );

  const [cart, setCart] = useState<Record<string, CartLine>>({});
  const [phone, setPhone] = useState('');
  const [placing, setPlacing] = useState(false);
  const [order, setOrder] = useState<any | null>(null);
  const [coupon, setCoupon] = useState('');
  const [couponMsg, setCouponMsg] = useState<string | null>(null);
  const [paying, setPaying] = useState(false);
  const [paid, setPaid] = useState(false);
  const [terminalOpen, setTerminalOpen] = useState(false);
  const [chargedRoom, setChargedRoom] = useState(false);
  const [ageConfirmed, setAgeConfirmed] = useState(false);
  const [reviewed, setReviewed] = useState(false);
  const [rating, setRating] = useState(0);
  const [reviewComment, setReviewComment] = useState('');
  const [reviewing, setReviewing] = useState(false);
  const [service, setService] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeCat, setActiveCat] = useState<number | null>(() => categories[0]?.id ?? null);
  const [sheetProduct, setSheetProduct] = useState<MenuProduct | null>(null);

  // Search + allergen filters over the menu.
  const [search, setSearch] = useState('');
  const [fAllergen, setFAllergen] = useState(false);
  const [fGluten, setFGluten] = useState(false);
  const [fLactose, setFLactose] = useState(false);

  const glutenId = useMemo(() => menu.allergens.find((a) => /glu/i.test(a.code) || /gluten/i.test(a.name))?.id ?? null, [menu.allergens]);
  const lactoseId = useMemo(
    () => menu.allergens.find((a) => /lac|milk|dairy|sut/i.test(a.code) || /lakto|süt/i.test(a.name))?.id ?? null,
    [menu.allergens],
  );

  const visible = useMemo(() => {
    const q = search.trim().toLocaleLowerCase(locale);
    if (!q && !fAllergen && !fGluten && !fLactose) return categories;
    return categories
      .map((c) => ({
        ...c,
        products: c.products.filter((p: any) => {
          if (q && !p.name.toLocaleLowerCase(locale).includes(q) && !(p.description ?? '').toLocaleLowerCase(locale).includes(q)) return false;
          const contains: number[] = p.nutrition?.allergens?.contains ?? [];
          if (fAllergen && contains.length > 0) return false;
          if (fGluten && glutenId != null && contains.includes(glutenId)) return false;
          if (fLactose && lactoseId != null && contains.includes(lactoseId)) return false;
          return true;
        }),
      }))
      .filter((c) => c.products.length > 0);
  }, [categories, search, fAllergen, fGluten, fLactose, glutenId, lactoseId, locale]);

  // Scroll-spy: the sticky category tabs track the section currently in view and
  // auto-scroll horizontally so the active tab stays centred as you move down.
  const navRef = useRef<HTMLElement | null>(null);
  const sectionRefs = useRef(new Map<number, HTMLElement>());
  const tabRefs = useRef(new Map<number, HTMLButtonElement>());
  const spyLockUntil = useRef(0);

  const lines = Object.values(cart);
  const total = lines.reduce((s, l) => s + l.unitPrice * l.qty, 0);
  const count = lines.reduce((s, l) => s + l.qty, 0);

  // Room/sunbed service: guests can defer payment onto the location's folio
  // (hotel rooms, beach-club sunbeds). Label adapts to the area type.
  const areaType = menu.table?.area_type;
  const canRoomCharge =
    ['hotel', 'beach'].includes(menu.venue.vertical ?? '') && (areaType === 'room' || areaType === 'sunbed');
  const chargeLabel = areaType === 'sunbed' ? t('chargeSunbed') : t('chargeRoom');
  const chargedLabel = areaType === 'sunbed' ? t('chargedSunbed') : t('chargedRoom');

  // Bar happy hour: server discounts the order authoritatively; mirror it in the
  // cart preview so the shown total matches what will be charged.
  const hhPercent = menu.venue.happy_hour?.active ? Number(menu.venue.happy_hour.percent) : 0;
  const discountedTotal = total * (1 - hhPercent / 100);

  // Live order tracking: poll the order until every item is served (KDS
  // advances item status → OrderItemStatusChanged also broadcasts over Reverb).
  useEffect(() => {
    if (!order || paid || order.status === 'served') return;
    const id = setInterval(async () => {
      try {
        const fresh = await api.request<any>(`/sessions/${encodeURIComponent(qrToken)}/orders/${order.id}`);
        setOrder(fresh);
      } catch {
        /* transient — keep polling */
      }
    }, 5000);
    return () => clearInterval(id);
  }, [order?.id, order?.status, paid, api, qrToken]);

  // Highlight the tab of the section currently under the sticky nav as we scroll.
  useEffect(() => {
    if (categories.length <= 1) return;
    let raf = 0;
    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        // A tab tap locks the spy while the page smooth-scrolls to that section.
        // Keep it locked until the animation SETTLES (refresh on every tick) so a
        // fixed timeout can't expire mid-glide and snap to a category we pass.
        const now = Date.now();
        if (now < spyLockUntil.current) {
          spyLockUntil.current = now + 120;
          return;
        }
        const nav = navRef.current;
        const triggerY = (nav ? nav.getBoundingClientRect().bottom : 0) + 8;
        let current = categories[0].id;
        for (const c of categories) {
          const el = sectionRefs.current.get(c.id);
          if (el && el.getBoundingClientRect().top <= triggerY) current = c.id;
        }
        // A short final section may never reach the trigger line — force it active
        // once scrolled to the bottom, but ONLY when the page can actually scroll
        // (else a menu that fits the viewport would wrongly light the last tab).
        const doc = document.documentElement;
        if (doc.scrollHeight - window.innerHeight > 4 && window.innerHeight + window.scrollY >= doc.scrollHeight - 2) {
          current = categories[categories.length - 1].id;
        }
        setActiveCat((prev) => (prev === current ? prev : current));
      });
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [categories]);

  // Keep the active tab centred within the horizontal strip.
  useEffect(() => {
    if (activeCat == null) return;
    const nav = navRef.current;
    const tab = tabRefs.current.get(activeCat);
    if (!nav || !tab) return;
    const navRect = nav.getBoundingClientRect();
    const tabRect = tab.getBoundingClientRect();
    const delta = tabRect.left - navRect.left - (nav.clientWidth - tab.clientWidth) / 2;
    if (Math.abs(delta) < 4) return;
    // Instant (not smooth): a concurrent smooth scroll here would cancel the
    // window's smooth scroll when a tab is tapped. The strip still follows crisply.
    nav.scrollTo({ left: nav.scrollLeft + delta });
  }, [activeCat]);

  // Tap a tab → smooth-scroll to its section (offset for the sticky nav) and
  // briefly suppress the spy so it doesn't fight the animation.
  function goToCategory(id: number) {
    const el = sectionRefs.current.get(id);
    if (!el) return;
    const navH = navRef.current?.getBoundingClientRect().height ?? 0;
    const y = el.getBoundingClientRect().top + window.scrollY - navH - 8;
    // Instant jump (not smooth): a concurrent re-render/effect reliably cancels a
    // programmatic smooth window-scroll here, leaving it stranded a few px down.
    // Instant scroll can't be cancelled and lands exactly on the tapped section.
    spyLockUntil.current = Date.now() + 400;
    setActiveCat(id);
    window.scrollTo({ top: y, behavior: 'auto' });
  }

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

  // Age-gate 18+ (alcohol) items once per session before they enter the cart.
  function guardedSet(sel: Omit<CartLine, 'key' | 'qty'>, qty: number) {
    if (qty > 0 && sel.product.age_restricted && !ageConfirmed) {
      if (!window.confirm(t('ageConfirm'))) return;
      setAgeConfirmed(true);
    }
    setLineQty(sel, qty);
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
    if (terminalPay) return payTerminal();
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

  // Kiosk: charge the attached physical POS terminal. The `terminal` gateway
  // completes server-side; we hold the "tap your card" screen for a moment so the
  // (simulated) card interaction feels real. A live provider would poll here.
  async function payTerminal() {
    setTerminalOpen(true);
    setPaying(true);
    try {
      const req = api.request(`/sessions/${encodeURIComponent(qrToken)}/orders/${order.id}/pay`, {
        method: 'POST',
        body: JSON.stringify({ gateway: 'terminal' }),
      });
      await new Promise((r) => setTimeout(r, 2600));
      await req;
      setPaid(true);
    } catch {
      /* ignore */
    } finally {
      setPaying(false);
      setTerminalOpen(false);
    }
  }

  async function chargeToRoom() {
    setPaying(true);
    try {
      await api.request(`/sessions/${encodeURIComponent(qrToken)}/orders/${order.id}/charge-to-room`, { method: 'POST' });
      setChargedRoom(true);
    } catch {
      /* ignore */
    } finally {
      setPaying(false);
    }
  }

  async function submitReview() {
    if (!rating || !order) return;
    setReviewing(true);
    try {
      await api.submitReview(qrToken, order.id, {
        rating,
        comment: reviewComment || undefined,
        customer: phone ? { phone } : undefined,
      });
      setReviewed(true);
    } catch {
      /* ignore */
    } finally {
      setReviewing(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl pb-32">
      {/* Light Nameless-style header */}
      <header
        className="bg-gradient-to-b from-brand-50/70 to-canvas px-5 pb-5 pt-7"
        style={
          /^#[0-9a-fA-F]{6}$/.test(menu.venue.brand_color ?? '')
            ? { background: `linear-gradient(180deg, ${menu.venue.brand_color}1f, var(--color-canvas))` }
            : undefined
        }
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            {menu.venue.logo && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={menu.venue.logo} alt={menu.venue.name} className="h-14 w-14 shrink-0 rounded-2xl object-cover shadow-[var(--shadow-card)]" />
            )}
            <div className="min-w-0">
              <h1 className="truncate text-xl font-extrabold tracking-tight text-ink">{menu.venue.name}</h1>
              {menu.venue.sub_title && <p className="truncate text-xs text-muted">{menu.venue.sub_title}</p>}
              {(menu.venue.reviews_count ?? 0) > 0 && (
                <p className="mt-0.5 text-xs font-medium text-muted">
                  ⭐ {menu.venue.rating} · {t('reviewCount', { count: menu.venue.reviews_count ?? 0 })}
                </p>
              )}
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button
              onClick={() => switchLocale(locale === 'tr' ? 'en' : 'tr')}
              className="rounded-full border border-line bg-white px-3 py-1 text-xs font-semibold text-ink transition hover:border-brand-300"
            >
              {locale === 'tr' ? 'EN' : 'TR'}
            </button>
            {tableCode && (
              <span className="rounded-full bg-brand-500 px-3 py-1 text-xs font-bold text-white">{tableCode}</span>
            )}
          </div>
        </div>

        {(menu.venue.timing || menu.venue.address) && (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {menu.venue.timing && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-700">
                <span className="h-1.5 w-1.5 rounded-full bg-brand-500 ring-2 ring-brand-100" />
                {t('openNow', { timing: menu.venue.timing })}
              </span>
            )}
            {menu.venue.address && (
              <span className="rounded-full bg-white px-3 py-1 text-xs text-muted shadow-[var(--shadow-card)]">📍 {menu.venue.address}</span>
            )}
          </div>
        )}

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            onClick={() => callService('call-waiter', t('called'))}
            className="rounded-full border border-line bg-white px-4 py-1.5 text-xs font-semibold text-ink transition hover:border-brand-300 hover:text-brand-700"
          >
            {t('callWaiter')}
          </button>
          <button
            onClick={() => callService('request-bill', t('requestBill'))}
            className="rounded-full border border-line bg-white px-4 py-1.5 text-xs font-semibold text-ink transition hover:border-brand-300 hover:text-brand-700"
          >
            {t('requestBill')}
          </button>
          {service && <span className="text-xs font-medium text-brand-700">✓ {service}</span>}
          {hhPercent > 0 && (
            <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-800">
              🍹 {t('happyHour')} −%{hhPercent}
            </span>
          )}
        </div>
      </header>

      {/* Category image cards — sticky, scroll-spy highlights & centres the active one */}
      {categories.length > 1 && (
        <nav
          ref={navRef}
          className="no-scrollbar sticky top-0 z-30 flex gap-3 overflow-x-auto border-b border-line bg-canvas/95 px-5 py-3 backdrop-blur"
        >
          {categories.map((c) => {
            const img = c.image_path || c.products?.[0]?.images?.[0];
            const active = activeCat === c.id;
            return (
              <button
                key={c.id}
                ref={(el) => {
                  if (el) tabRefs.current.set(c.id, el);
                  else tabRefs.current.delete(c.id);
                }}
                onClick={() => goToCategory(c.id)}
                className={`relative aspect-[5/4] w-28 shrink-0 overflow-hidden rounded-2xl shadow-[var(--shadow-card)] transition ${
                  active ? 'ring-2 ring-brand-500 ring-offset-2 ring-offset-canvas' : ''
                }`}
              >
                {img ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={img} alt={c.name} className="absolute inset-0 h-full w-full object-cover" />
                ) : (
                  <div className="absolute inset-0 bg-gradient-to-br from-brand-500 to-brand-700" />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/25 to-transparent" />
                <span className="absolute inset-0 flex items-center justify-center px-2 text-center text-sm font-extrabold leading-tight text-white [text-shadow:0_2px_10px_rgba(0,0,0,0.55)]">
                  {c.name}
                </span>
              </button>
            );
          })}
        </nav>
      )}

      {/* Search + allergen filters */}
      <div className="flex flex-col gap-2 px-5 pb-1 pt-3 sm:flex-row sm:items-center">
        <div className="flex flex-1 items-center gap-2 rounded-xl border border-line bg-white px-3.5 py-2.5">
          <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0 text-muted" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3-3" strokeLinecap="round" />
          </svg>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search..."
            className="w-full bg-transparent text-sm text-ink outline-none placeholder:text-muted"
          />
          {search && (
            <button onClick={() => setSearch('')} aria-label={t('clear')} className="shrink-0 text-muted transition hover:text-ink">
              ✕
            </button>
          )}
        </div>
        <div className="no-scrollbar flex items-center gap-2 overflow-x-auto">
          <FilterChip active={fAllergen} onClick={() => setFAllergen((x) => !x)} tone="red">⚠️ Allergen</FilterChip>
          <FilterChip active={fGluten} onClick={() => setFGluten((x) => !x)} tone="amber">🌾 Gluten</FilterChip>
          <FilterChip active={fLactose} onClick={() => setFLactose((x) => !x)} tone="sky">🥛 Lactose</FilterChip>
        </div>
      </div>

      {order && (
        <OrderPanel
          order={order}
          fmt={fmt}
          t={t}
          productNames={productNames}
          coupon={coupon}
          setCoupon={setCoupon}
          couponMsg={couponMsg}
          applyCoupon={applyCoupon}
          pay={pay}
          paying={paying}
          paid={paid}
          canRoomCharge={canRoomCharge}
          chargeToRoom={chargeToRoom}
          chargedRoom={chargedRoom}
          chargeLabel={chargeLabel}
          chargedLabel={chargedLabel}
          reviewed={reviewed || order.reviewed}
          rating={rating}
          setRating={setRating}
          reviewComment={reviewComment}
          setReviewComment={setReviewComment}
          submitReview={submitReview}
          reviewing={reviewing}
        />
      )}

      {visible.length === 0 && (
        <p className="px-5 py-16 text-center text-sm text-muted">{t('noResults', { search })}</p>
      )}

      {visible.map((c) => (
        <section
          key={c.id}
          ref={(el) => {
            if (el) sectionRefs.current.set(c.id, el);
            else sectionRefs.current.delete(c.id);
          }}
          className="px-5 pt-6"
        >
          <div className="mb-3 flex items-center gap-3">
            <h2 className="text-lg font-bold text-ink">{c.name}</h2>
            <span className="h-px flex-1 bg-line" />
          </div>
          <div className="space-y-2.5">
            {c.products.map((p) => (
              <ProductRow key={p.id} product={p} qtyFor={qtyFor} onSet={guardedSet} onOpen={setSheetProduct} fmt={fmt} mt={mt} />
            ))}
          </div>
        </section>
      ))}

      {menu.venue.powered_by !== false && (
        <div className="mt-8 flex items-center justify-center gap-1.5 text-xs text-muted">
          <span>Powered by</span>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/comiqr-logo.png" alt="ComiQR" className="h-4 w-auto opacity-80" />
        </div>
      )}

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
                {hhPercent > 0 ? (
                  <>
                    <span className="mr-1 text-xs line-through">{fmt.format(total)}</span>
                    <b className="font-display text-base text-ink">{fmt.format(discountedTotal)}</b>
                  </>
                ) : (
                  <b className="font-display text-base text-ink">{fmt.format(total)}</b>
                )}
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

      {sheetProduct && (
        <ProductSheet
          product={sheetProduct}
          allergenMap={allergenMap}
          fmt={fmt}
          t={t}
          mt={mt}
          onClose={() => setSheetProduct(null)}
          onAdd={(sel: any) => {
            guardedSet(sel, qtyFor(sel.product.id, sel.variantId, sel.modifierIds) + 1);
            setSheetProduct(null);
          }}
        />
      )}

      {menu.venue?.ai_chat && <MenuChat slug={menu.venue?.slug} />}

      {/* Kiosk: physical POS terminal payment overlay */}
      {terminalOpen && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-5 px-8 text-center text-white" style={{ background: 'color-mix(in srgb, var(--color-navy) 96%, transparent)' }}>
          <p className="text-sm font-bold uppercase tracking-[0.3em]" style={{ color: '#ffffff', opacity: 0.8 }}>
            {t('terminalTitle')}
          </p>
          <div className="text-6xl font-black" style={{ color: '#ffffff' }}>
            {fmt.format(Number(order?.grand_total ?? 0))}
          </div>
          <div className="my-1 grid h-32 w-32 animate-pulse place-items-center rounded-3xl bg-white/10 text-6xl">💳</div>
          <p className="text-2xl font-bold" style={{ color: '#ffffff' }}>{t('terminalPrompt')}</p>
          <p className="text-sm" style={{ color: '#ffffff', opacity: 0.75 }}>{t('terminalHint')}</p>
          <div className="mt-3 flex items-center gap-2 text-sm" style={{ color: '#ffffff', opacity: 0.9 }}>
            <span className="h-2.5 w-2.5 animate-ping rounded-full bg-white" />
            {t('terminalProcessing')}
          </div>
        </div>
      )}
    </div>
  );
}

function FilterChip({ active, onClick, tone, children }: { active: boolean; onClick: () => void; tone: 'red' | 'amber' | 'sky'; children: React.ReactNode }) {
  const tones = {
    red: active ? 'border-red-300 bg-red-100 text-red-700' : 'border-red-200 bg-red-50 text-red-600',
    amber: active ? 'border-amber-400 bg-amber-200 text-amber-900' : 'border-amber-200 bg-amber-50 text-amber-700',
    sky: active ? 'border-sky-400 bg-sky-200 text-sky-900' : 'border-sky-200 bg-sky-50 text-sky-700',
  };
  return (
    <button
      onClick={onClick}
      className={`shrink-0 whitespace-nowrap rounded-lg border px-2.5 py-1 text-xs font-semibold transition ${tones[tone]}`}
    >
      {children}
    </button>
  );
}

function OrderPanel({ order, fmt, t, productNames, coupon, setCoupon, couponMsg, applyCoupon, pay, paying, paid, canRoomCharge, chargeToRoom, chargedRoom, chargeLabel, chargedLabel, reviewed, rating, setRating, reviewComment, setReviewComment, submitReview, reviewing }: any) {
  const items = order.items ?? [];
  return (
    <div className="mx-5 mt-5 overflow-hidden rounded-2xl border border-sage/30 bg-sage-bg">
      <div className="flex items-center justify-between px-5 py-4">
        <span className="text-sm font-medium text-[color:var(--color-sage)]">
          ✓ {t('placed')} <span className="text-muted">(#{order.id})</span>
        </span>
        <span className="font-display text-lg font-semibold text-ink">{fmt.format(Number(order.grand_total))}</span>
      </div>

      {items.length > 0 && (
        <div className="border-t border-sage/20 bg-white/60 px-5 py-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">{t('tracking')}</p>
          <ul className="space-y-1.5">
            {items.map((i: any) => (
              <li key={i.id} className="flex items-center justify-between gap-3 text-sm">
                <span className="min-w-0 truncate text-ink">
                  <b className="font-semibold">{i.quantity}×</b>{' '}
                  {productNames.get(i.product_id) ?? `#${i.product_id}`}
                </span>
                <OrderStatus status={i.status} t={t} />
              </li>
            ))}
          </ul>
        </div>
      )}

      {paid ? (
        <p className="px-5 pb-4 font-semibold text-[color:var(--color-sage)]">✓ {t('paid')}</p>
      ) : chargedRoom ? (
        <p className="px-5 pb-4 font-semibold text-[color:var(--color-sage)]">🧾 {chargedLabel}</p>
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
          {canRoomCharge && (
            <button
              onClick={chargeToRoom}
              disabled={paying}
              className="w-full rounded-xl border border-brand-500 bg-white py-3 text-sm font-semibold text-brand-600 transition hover:bg-brand-50 disabled:opacity-60"
            >
              🧾 {chargeLabel}
            </button>
          )}
        </div>
      )}

      {(paid || chargedRoom || order.status === 'served') &&
        (reviewed ? (
          <p className="border-t border-sage/20 bg-white/60 px-5 py-4 text-sm font-medium text-[color:var(--color-sage)]">
            ⭐ {t('reviewThanks')}
          </p>
        ) : (
          <div className="space-y-2 border-t border-sage/20 bg-white/60 px-5 py-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">{t('rateOrder')}</p>
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setRating(s)}
                  aria-label={`${s}`}
                  className={`text-2xl leading-none transition ${s <= rating ? 'text-amber-400' : 'text-line'}`}
                >
                  ★
                </button>
              ))}
            </div>
            <textarea
              value={reviewComment}
              onChange={(e) => setReviewComment(e.target.value)}
              placeholder={t('reviewPlaceholder')}
              rows={2}
              className="w-full rounded-xl border border-line bg-white px-3.5 py-2.5 text-sm outline-none focus:border-brand-500"
            />
            <button
              onClick={submitReview}
              disabled={reviewing || !rating}
              className="w-full rounded-xl bg-brand-500 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-600 disabled:opacity-50"
            >
              {reviewing ? '…' : t('submitReview')}
            </button>
          </div>
        ))}
    </div>
  );
}

function ProductRow({ product, qtyFor, onSet, onOpen, fmt, mt }: any) {
  const hasOptions = (product.variants?.length ?? 0) > 0 || (product.modifier_groups?.length ?? 0) > 0;
  const n = product.nutrition;
  const baseQty = qtyFor(product.id, undefined, []);
  const base = () => ({
    product,
    variantId: undefined,
    variantName: undefined,
    modifierIds: [],
    modifierNames: [],
    unitPrice: Number(product.price),
  });

  return (
    <article className="flex items-center gap-3 rounded-2xl border border-line bg-surface p-2.5 shadow-[var(--shadow-card)]">
      <button onClick={() => onOpen(product)} className="shrink-0" aria-label={product.name}>
        {product.images?.[0] ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={product.images[0]} alt={product.name} className="h-16 w-16 rounded-xl object-cover" />
        ) : (
          <div className="grid h-16 w-16 place-items-center rounded-xl bg-canvas text-[10px] font-medium text-muted">
            {product.name.slice(0, 2)}
          </div>
        )}
      </button>
      <button onClick={() => onOpen(product)} className="min-w-0 flex-1 text-left">
        <div className="flex items-baseline justify-between gap-2">
          <h3 className="truncate text-sm font-semibold text-ink">
            {product.name}
            {product.age_restricted && (
              <span className="ml-1.5 rounded bg-red-100 px-1 py-0.5 text-[10px] font-bold text-red-700">18+</span>
            )}
          </h3>
          <span className="shrink-0 text-sm font-extrabold text-ink">{fmt.format(Number(product.price))}</span>
        </div>
        {product.description && <p className="mt-0.5 line-clamp-1 text-xs text-muted">{product.description}</p>}
        {n && (
          <span className="mt-1 inline-block rounded-full bg-brand-50 px-2 py-0.5 text-[11px] font-semibold text-brand-700">
            {Math.round(n.kcal)} {mt('kcal')}
          </span>
        )}
      </button>
      {hasOptions || baseQty === 0 ? (
        <button
          onClick={() => (hasOptions ? onOpen(product) : onSet(base(), 1))}
          className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-brand-500 text-xl font-bold leading-none text-white shadow-sm transition hover:bg-brand-600 active:scale-95"
          aria-label="+"
        >
          +
        </button>
      ) : (
        <div className="inline-flex shrink-0 items-center gap-1 rounded-full bg-brand-500 p-1 shadow-sm">
          <Step onClick={() => onSet(base(), baseQty - 1)}>−</Step>
          <span className="min-w-4 text-center text-sm font-bold text-white">{baseQty}</span>
          <Step onClick={() => onSet(base(), baseQty + 1)}>+</Step>
        </div>
      )}
    </article>
  );
}

/** Bottom sheet: full product detail — nutrition, variants, modifiers — then add. */
function ProductSheet({ product, allergenMap, fmt, t, mt, onClose, onAdd }: any) {
  const variants = product.variants ?? [];
  const groups: MenuModifierGroup[] = product.modifier_groups ?? [];
  const [variantId, setVariantId] = useState<number | undefined>(
    variants.find((v: any) => v.is_default)?.id ?? variants[0]?.id,
  );
  const [selected, setSelected] = useState<Record<number, number[]>>({});
  const [detail, setDetail] = useState(false);

  const n = product.nutrition;
  const contains = (n?.allergens.contains ?? []).map((id: number) => allergenMap.get(id)?.name).filter(Boolean);
  const variant = variants.find((v: any) => v.id === variantId);
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

  function toggleModifier(g: MenuModifierGroup, id: number) {
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
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/40 sm:items-center" onClick={onClose}>
      <div
        className="max-h-[88vh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-surface sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        {product.images?.[0] && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={product.images[0]} alt={product.name} className="h-44 w-full object-cover" />
        )}
        <div className="p-5">
          <div className="flex items-start justify-between gap-3">
            <h3 className="text-lg font-semibold text-ink">
              {product.name}
              {product.age_restricted && (
                <span className="ml-2 rounded-full bg-red-100 px-1.5 py-0.5 align-middle text-xs font-bold text-red-700">18+</span>
              )}
            </h3>
            <button onClick={onClose} className="shrink-0 text-2xl leading-none text-muted">
              ×
            </button>
          </div>
          {product.description && <p className="mt-1 text-sm leading-relaxed text-muted">{product.description}</p>}

          {n && (
            <div className="mt-3 flex flex-wrap items-center gap-1.5">
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
            <div className="mt-4">
              <p className="mb-1.5 text-xs font-semibold text-ink">{mt('size')}</p>
              <div className="flex flex-wrap gap-1.5">
                {variants.map((v: any) => (
                  <button
                    key={v.id}
                    onClick={() => setVariantId(v.id)}
                    className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                      v.id === variantId ? 'bg-brand-500 text-white' : 'border border-line bg-surface text-muted hover:border-brand-500'
                    }`}
                  >
                    {v.name}
                    {Number(v.price_delta) ? ` +${fmt.format(Number(v.price_delta))}` : ''}
                  </button>
                ))}
              </div>
            </div>
          )}

          {groups.map((g) => (
            <div key={g.id} className="mt-4">
              <div className="mb-1.5 flex items-center gap-2">
                <span className="text-xs font-semibold text-ink">{g.name}</span>
                {g.is_required ? (
                  <span className="rounded-full bg-brand-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-brand-600">
                    {t('required')}
                  </span>
                ) : (
                  <span className="text-[10px] text-muted">{g.max_select > 1 ? t('upTo', { count: g.max_select }) : t('optional')}</span>
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
                        on ? 'bg-brand-500 text-white' : 'border border-line bg-surface text-muted hover:border-brand-500'
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

          <button
            onClick={() => onAdd({ product, variantId, variantName: variant?.name, modifierIds, modifierNames, unitPrice })}
            disabled={missingRequired}
            className="mt-5 w-full rounded-xl bg-brand-500 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {missingRequired ? t('chooseRequired') : `${t('add')} · ${fmt.format(unitPrice)}`}
          </button>
        </div>
      </div>
    </div>
  );
}

function Step({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button onClick={onClick} className="grid h-7 w-7 place-items-center rounded-lg bg-white text-lg font-bold text-brand-600 shadow-sm">
      {children}
    </button>
  );
}
function OrderStatus({ status, t }: { status: string; t: any }) {
  const style: Record<string, string> = {
    pending: 'bg-canvas text-muted',
    preparing: 'bg-amber-bg text-[color:var(--color-amber)]',
    ready: 'bg-sage-bg text-[color:var(--color-sage)]',
    served: 'bg-brand-50 text-brand-700',
    cancelled: 'bg-red-50 text-red-600',
  };
  const dot: Record<string, string> = {
    pending: '○',
    preparing: '◐',
    ready: '●',
    served: '✓',
    cancelled: '×',
  };
  const key = status in style ? status : 'pending';
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${style[key]}`}
    >
      <span aria-hidden>{dot[key]}</span>
      {t(`st_${key}`)}
    </span>
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
