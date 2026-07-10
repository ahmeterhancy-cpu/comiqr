'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

/** A cart line shared (via localStorage) between the slug menu and /order checkout. */
export type CartLine = {
  key: string; // productId::variantId::sortedModifierIds
  id: number; // product id
  name: string;
  variantId?: number;
  variantName?: string;
  modifierIds: number[];
  modifierNames: string[];
  price: number; // unit price (base + variant + modifiers)
  qty: number;
};

export function lineKey(productId: number, variantId: number | undefined, modifierIds: number[]): string {
  return `${productId}::${variantId ?? 0}::${[...modifierIds].sort((a, b) => a - b).join(',')}`;
}

const storeKey = (slug: string) => `cq-cart:${slug}`;
const EVT = 'cq-cart-changed';

export function readCart(slug: string): CartLine[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(storeKey(slug));
    const val = raw ? JSON.parse(raw) : [];
    return Array.isArray(val) ? val : [];
  } catch {
    return [];
  }
}

function writeCart(slug: string, lines: CartLine[]) {
  try {
    window.localStorage.setItem(storeKey(slug), JSON.stringify(lines));
    window.dispatchEvent(new CustomEvent(EVT, { detail: slug }));
  } catch {
    /* ignore quota / private-mode errors */
  }
}

export function clearCart(slug: string) {
  try {
    window.localStorage.removeItem(storeKey(slug));
    window.dispatchEvent(new CustomEvent(EVT, { detail: slug }));
  } catch {
    /* ignore */
  }
}

/** Reactive cart backed by localStorage; every hook instance stays in sync via a custom event. */
export function useCart(slug: string) {
  const [lines, setLines] = useState<CartLine[]>([]);

  useEffect(() => {
    setLines(readCart(slug));
    const sync = () => setLines(readCart(slug));
    window.addEventListener(EVT, sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener(EVT, sync);
      window.removeEventListener('storage', sync);
    };
  }, [slug]);

  const setQty = useCallback(
    (line: Omit<CartLine, 'qty'>, qty: number) => {
      const cur = readCart(slug);
      const idx = cur.findIndex((l) => l.key === line.key);
      let next: CartLine[];
      if (qty <= 0) next = cur.filter((l) => l.key !== line.key);
      else if (idx >= 0) next = cur.map((l) => (l.key === line.key ? { ...l, ...line, qty } : l));
      else next = [...cur, { ...line, qty }];
      writeCart(slug, next);
      setLines(next);
    },
    [slug],
  );

  const qtyOfKey = useCallback((key: string) => lines.find((l) => l.key === key)?.qty ?? 0, [lines]);
  const qtyOfProduct = useCallback((id: number) => lines.filter((l) => l.id === id).reduce((s, l) => s + l.qty, 0), [lines]);
  const count = lines.reduce((s, l) => s + l.qty, 0);
  const total = lines.reduce((s, l) => s + l.price * l.qty, 0);

  return { lines, count, total, qtyOfKey, qtyOfProduct, setQty, clear: () => clearCart(slug) };
}

/** Floating cart button + bottom-sheet listing what the guest added. */
export function CartFab({ slug, currency, locale }: { slug: string; currency?: string | null; locale?: string | null }) {
  const { lines, count, total, setQty } = useCart(slug);
  const [open, setOpen] = useState(false);
  const fmt = useMemo(
    () => new Intl.NumberFormat(locale || 'tr', { style: 'currency', currency: currency || 'TRY', maximumFractionDigits: 0 }),
    [currency, locale],
  );

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Sepetim"
        className="fixed bottom-6 right-4 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-brand-500 shadow-lg transition hover:bg-brand-600 active:scale-95"
        style={{ color: '#ffffff' }}
      >
        <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="9" cy="20" r="1.4" />
          <circle cx="19" cy="20" r="1.4" />
          <path d="M2 3h3l2.2 12.3a1.5 1.5 0 0 0 1.5 1.2h8.6a1.5 1.5 0 0 0 1.5-1.2L22 7H6.2" />
        </svg>
        {count > 0 && (
          <span
            className="absolute -right-1 -top-1 grid h-6 min-w-6 place-items-center rounded-full border-2 border-canvas bg-red-500 px-1 text-xs font-bold"
            style={{ color: '#ffffff' }}
          >
            {count}
          </span>
        )}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center" onClick={() => setOpen(false)}>
          <div
            className="max-h-[85vh] w-full max-w-md overflow-hidden rounded-t-3xl bg-canvas sm:rounded-3xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-line px-5 py-4">
              <h3 className="text-base font-bold text-ink">Sepetim</h3>
              <button type="button" onClick={() => setOpen(false)} aria-label="Kapat" className="text-muted hover:text-ink">
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="m6 6 12 12M18 6 6 18" /></svg>
              </button>
            </div>

            {lines.length === 0 ? (
              <div className="px-5 py-12 text-center text-sm text-muted">Sepetiniz boş.</div>
            ) : (
              <div className="max-h-[55vh] divide-y divide-line overflow-y-auto px-5">
                {lines.map((l) => {
                  const extras = [l.variantName, ...l.modifierNames].filter(Boolean).join(', ');
                  return (
                    <div key={l.key} className="flex items-center gap-3 py-3">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-ink">{l.name}</p>
                        {extras && <p className="truncate text-[11px] text-muted">{extras}</p>}
                        <p className="text-xs text-muted">{fmt.format(l.price)}</p>
                      </div>
                      <div className="flex items-center gap-2 rounded-full bg-brand-500 px-1.5 py-1" style={{ color: '#ffffff' }}>
                        <button type="button" onClick={() => setQty(l, l.qty - 1)} aria-label="Azalt" className="grid h-6 w-6 place-items-center rounded-full bg-white/20 font-bold">−</button>
                        <span className="min-w-5 text-center text-sm font-bold">{l.qty}</span>
                        <button type="button" onClick={() => setQty(l, l.qty + 1)} aria-label="Artır" className="grid h-6 w-6 place-items-center rounded-full bg-white/20 font-bold">+</button>
                      </div>
                      <div className="w-16 shrink-0 text-right text-sm font-bold text-ink">{fmt.format(l.price * l.qty)}</div>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="border-t border-line px-5 py-4">
              <div className="mb-3 flex items-center justify-between text-sm">
                <span className="text-muted">Toplam</span>
                <span className="text-lg font-extrabold text-ink">{fmt.format(total)}</span>
              </div>
              <a
                href={`/order/${slug}`}
                aria-disabled={lines.length === 0}
                className={`block rounded-xl py-3 text-center text-sm font-semibold ${lines.length === 0 ? 'pointer-events-none bg-line text-muted' : 'bg-brand-500'}`}
                style={lines.length === 0 ? undefined : { color: '#ffffff' }}
              >
                Siparişi Tamamla
              </a>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
