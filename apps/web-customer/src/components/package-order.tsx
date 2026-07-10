'use client';

import { useEffect, useMemo, useState } from 'react';
import { ApiClient } from '@comiqr/shared-types/client';
import type { Menu, MenuModifierGroup, MenuProduct } from '@comiqr/shared-types';
import { clearCart, readCart } from './cart';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://127.0.0.1:8000/v1';

interface CartLine {
  key: string;
  product: MenuProduct;
  qty: number;
  variantId?: number;
  variantName?: string;
  modifierIds: number[];
  modifierNames: string[];
  unitPrice: number;
}

function lineKey(productId: number, variantId: number | undefined, modifierIds: number[]): string {
  return `${productId}::${variantId ?? 0}::${[...modifierIds].sort((a, b) => a - b).join(',')}`;
}

type TikoForm = { url: string; fields: Record<string, string> };

export function PackageOrder({ menu, slug }: { menu: Menu; slug: string }) {
  const api = useMemo(() => new ApiClient({ baseUrl: API_URL }), []);
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
  const [step, setStep] = useState<'menu' | 'checkout'>('menu');
  const [type, setType] = useState<'delivery' | 'takeaway'>('delivery');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [note, setNote] = useState('');
  const [method, setMethod] = useState<'cod' | 'online'>('cod');
  const [saveCard, setSaveCard] = useState(false);
  const [savedCards, setSavedCards] = useState<{ id: number; alias: string | null; last4: string | null }[]>([]);
  const [savedCardId, setSavedCardId] = useState<number | null>(null);
  const [placing, setPlacing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<any | null>(null);
  const [tiko, setTiko] = useState<TikoForm | null>(null);

  const lines = Object.values(cart);
  const total = lines.reduce((s, l) => s + l.unitPrice * l.qty, 0);
  const count = lines.reduce((s, l) => s + l.qty, 0);
  const categories = menu.categories.filter((c) => c.products.length > 0);

  // Offer the customer's saved cards once they've entered a phone at checkout.
  useEffect(() => {
    if (step !== 'checkout' || method !== 'online' || phone.trim().length < 6) {
      setSavedCards([]);
      setSavedCardId(null);
      return;
    }
    let active = true;
    api
      .venueCards(slug, phone.trim())
      .then((c) => active && setSavedCards(c))
      .catch(() => active && setSavedCards([]));
    return () => {
      active = false;
    };
  }, [step, method, phone, api, slug]);

  // Hydrate the checkout cart from the quick-cart the guest built on the slug menu.
  useEffect(() => {
    const stored = readCart(slug);
    if (stored.length === 0) return;
    const byId = new Map<number, MenuProduct>();
    menu.categories.forEach((c) => c.products.forEach((p) => byId.set(p.id, p)));
    const next: Record<string, CartLine> = {};
    for (const s of stored) {
      const product = byId.get(s.id);
      if (!product) continue;
      next[s.key] = {
        key: s.key,
        product,
        qty: s.qty,
        variantId: s.variantId,
        variantName: s.variantName,
        modifierIds: s.modifierIds ?? [],
        modifierNames: s.modifierNames ?? [],
        unitPrice: s.price,
      };
    }
    if (Object.keys(next).length > 0) setCart(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Clear the shared quick-cart once the order is placed.
  useEffect(() => {
    if (done) clearCart(slug);
  }, [done, slug]);

  function qtyFor(productId: number, variantId: number | undefined, modifierIds: number[]) {
    return cart[lineKey(productId, variantId, modifierIds)]?.qty ?? 0;
  }
  function setLine(sel: Omit<CartLine, 'key' | 'qty'>, qty: number) {
    const key = lineKey(sel.product.id, sel.variantId, sel.modifierIds);
    setCart((c) => {
      const n = { ...c };
      if (qty <= 0) delete n[key];
      else n[key] = { ...sel, key, qty };
      return n;
    });
  }

  async function submit() {
    setPlacing(true);
    setError(null);
    try {
      const res = await api.venueOrder(slug, {
        type,
        items: lines.map((l) => ({
          product_id: l.product.id,
          quantity: l.qty,
          variant_id: l.variantId,
          modifiers: l.modifierIds,
        })),
        contact: { name, phone, address: type === 'delivery' ? address : undefined },
        note: note || undefined,
        payment_method: method,
        save_card: method === 'online' && !savedCardId ? saveCard : undefined,
        saved_card_id: method === 'online' ? savedCardId ?? undefined : undefined,
      });
      if (method === 'online' && res.session?.kind === 'form') {
        setTiko({ url: res.session.url, fields: res.session.meta.fields });
      } else {
        setDone(res.order);
      }
    } catch {
      setError('Sipariş oluşturulamadı. Bilgileri kontrol edin (adres/telefon zorunlu).');
    } finally {
      setPlacing(false);
    }
  }

  if (tiko) return <TikoCardForm form={tiko} fmt={fmt} total={total} />;
  if (done) return <SuccessView order={done} method={method} fmt={fmt} />;

  return (
    <div className="mx-auto max-w-2xl pb-32">
      <header className="relative overflow-hidden bg-[color:var(--color-navy)] px-6 pb-6 pt-8 text-white">
        {menu.venue.cover && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={menu.venue.cover} alt="" className="absolute inset-0 h-full w-full object-cover opacity-25" />
        )}
        <div className="relative flex items-center gap-3">
          {menu.venue.logo && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={menu.venue.logo} alt={menu.venue.name} className="h-14 w-14 shrink-0 rounded-xl object-cover ring-2 ring-white/40" />
          )}
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-white/70">Paket Servis</p>
            <h1 className="font-display text-2xl font-semibold leading-tight" style={{ color: '#ffffff' }}>
              {menu.venue.name}
            </h1>
            {menu.venue.sub_title && <p className="text-sm text-white/80">{menu.venue.sub_title}</p>}
          </div>
        </div>
      </header>

      {step === 'menu' ? (
        <>
          {categories.map((c) => (
            <section key={c.id} className="px-5 pt-6">
              <h2 className="mb-3 font-display text-lg font-semibold text-ink">{c.name}</h2>
              <div className="space-y-3">
                {c.products.map((p) => (
                  <ProductRow key={p.id} product={p} fmt={fmt} qtyFor={qtyFor} onSet={setLine} />
                ))}
              </div>
            </section>
          ))}
        </>
      ) : (
        <CheckoutForm
          {...{ type, setType, name, setName, phone, setPhone, address, setAddress, note, setNote, method, setMethod, error, placing, submit, total, fmt }}
          {...{ savedCards, savedCardId, setSavedCardId, saveCard, setSaveCard }}
          onBack={() => setStep('menu')}
        />
      )}

      {count > 0 && step === 'menu' && (
        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-surface/95 px-5 pb-4 pt-3 backdrop-blur">
          <div className="mx-auto flex max-w-2xl items-center justify-between gap-3">
            <span className="text-sm text-muted">
              {count} ürün · <b className="font-display text-base text-ink">{fmt.format(total)}</b>
            </span>
            <button
              onClick={() => setStep('checkout')}
              className="rounded-xl bg-brand-500 px-6 py-3 text-sm font-semibold text-white"
              style={{ color: '#ffffff' }}
            >
              Devam
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function ProductRow({ product, fmt, qtyFor, onSet }: any) {
  const variants = product.variants ?? [];
  const groups: MenuModifierGroup[] = product.modifier_groups ?? [];
  const [variantId, setVariantId] = useState<number | undefined>(
    variants.find((v: any) => v.is_default)?.id ?? variants[0]?.id,
  );
  const [selected, setSelected] = useState<Record<number, number[]>>({});

  const variant = variants.find((v: any) => v.id === variantId);
  const chosen = groups.flatMap((g) =>
    (selected[g.id] ?? []).map((id) => g.modifiers.find((m) => m.id === id)).filter(Boolean),
  ) as { id: number; name: string; price_delta: string | number }[];
  const modifierIds = chosen.map((m) => m.id);
  const modTotal = chosen.reduce((s, m) => s + Number(m.price_delta), 0);
  const unitPrice = Number(product.price) + Number(variant?.price_delta ?? 0) + modTotal;
  const missingRequired = groups.some((g) => {
    const min = g.is_required ? Math.max(1, g.min_select) : g.min_select;
    return (selected[g.id] ?? []).length < min;
  });
  const cartQty = qtyFor(product.id, variantId, modifierIds);

  function toggle(g: MenuModifierGroup, id: number) {
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
  const sel = () => ({
    product,
    variantId,
    variantName: variant?.name,
    modifierIds,
    modifierNames: chosen.map((m) => m.name),
    unitPrice,
  });

  return (
    <article className="rounded-2xl border border-line bg-surface p-4">
      <div className="flex items-start justify-between gap-3">
        <h3 className="font-display text-base font-semibold text-ink">{product.name}</h3>
        <span className="shrink-0 font-display font-semibold text-ink">{fmt.format(unitPrice)}</span>
      </div>
      {product.description && <p className="mt-1 text-sm text-muted">{product.description}</p>}

      {variants.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {variants.map((v: any) => (
            <button
              key={v.id}
              onClick={() => setVariantId(v.id)}
              className={`rounded-full px-3 py-1 text-xs font-medium ${
                v.id === variantId ? 'bg-brand-500 text-white' : 'border border-line text-muted'
              }`}
            >
              {v.name}
            </button>
          ))}
        </div>
      )}

      {groups.map((g) => (
        <div key={g.id} className="mt-2">
          <div className="mb-1 text-xs font-semibold text-ink">
            {g.name} {g.is_required && <span className="text-brand-600">*</span>}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {g.modifiers.map((m) => {
              const on = (selected[g.id] ?? []).includes(m.id);
              return (
                <button
                  key={m.id}
                  onClick={() => toggle(g, m.id)}
                  className={`rounded-full px-3 py-1 text-xs font-medium ${
                    on ? 'bg-brand-500 text-white' : 'border border-line text-muted'
                  }`}
                >
                  {m.name}
                  {Number(m.price_delta) ? ` +${fmt.format(Number(m.price_delta))}` : ''}
                </button>
              );
            })}
          </div>
        </div>
      ))}

      <div className="mt-3 flex items-center justify-end gap-3">
        {missingRequired && cartQty === 0 && <span className="text-[11px] text-muted">Zorunlu seçim yapın</span>}
        {cartQty === 0 ? (
          <button
            onClick={() => onSet(sel(), 1)}
            disabled={missingRequired}
            className="rounded-full bg-brand-500 px-5 py-2 text-sm font-semibold text-white disabled:opacity-40"
            style={{ color: '#ffffff' }}
          >
            + Ekle
          </button>
        ) : (
          <div className="inline-flex items-center gap-2 rounded-full bg-brand-500 p-1">
            <button onClick={() => onSet(sel(), cartQty - 1)} className="grid h-7 w-7 place-items-center rounded-lg bg-white font-bold text-brand-600">
              −
            </button>
            <span className="min-w-5 text-center text-sm font-bold text-white">{cartQty}</span>
            <button onClick={() => onSet(sel(), cartQty + 1)} className="grid h-7 w-7 place-items-center rounded-lg bg-white font-bold text-brand-600">
              +
            </button>
          </div>
        )}
      </div>
    </article>
  );
}

function CheckoutForm({ type, setType, name, setName, phone, setPhone, address, setAddress, note, setNote, method, setMethod, error, placing, submit, total, fmt, savedCards, savedCardId, setSavedCardId, saveCard, setSaveCard, onBack }: any) {
  const canSubmit = name.trim() && phone.trim() && (type === 'takeaway' || address.trim());
  return (
    <div className="px-5 pt-6">
      <button onClick={onBack} className="mb-3 text-sm text-brand-600">
        ← Menüye dön
      </button>

      <div className="mb-4 grid grid-cols-2 gap-2">
        {(['delivery', 'takeaway'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setType(t)}
            className={`rounded-xl border px-4 py-3 text-sm font-semibold ${
              type === t ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-line text-muted'
            }`}
          >
            {t === 'delivery' ? 'Adrese Teslimat' : 'Gel-Al'}
          </button>
        ))}
      </div>

      <div className="space-y-2.5">
        <Field label="Ad Soyad" value={name} onChange={setName} placeholder="Adınız" />
        <Field label="Telefon" value={phone} onChange={setPhone} placeholder="05xx…" />
        {type === 'delivery' && (
          <Field label="Adres" value={address} onChange={setAddress} placeholder="Teslimat adresi" textarea />
        )}
        <Field label="Not (opsiyonel)" value={note} onChange={setNote} placeholder="Kapı zili, kat…" />
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2">
        {(['cod', 'online'] as const).map((m) => (
          <button
            key={m}
            onClick={() => setMethod(m)}
            className={`rounded-xl border px-4 py-3 text-sm font-semibold ${
              method === m ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-line text-muted'
            }`}
          >
            {m === 'cod' ? 'Kapıda Ödeme' : 'Online Ödeme'}
          </button>
        ))}
      </div>

      {method === 'online' && (
        <div className="mt-3 space-y-2 rounded-xl border border-line bg-canvas p-3">
          {savedCards.length > 0 && (
            <>
              <p className="text-xs font-semibold text-ink">Kayıtlı kartlar</p>
              {savedCards.map((c: any) => (
                <label key={c.id} className="flex items-center gap-2 text-sm">
                  <input
                    type="radio"
                    name="savedcard"
                    checked={savedCardId === c.id}
                    onChange={() => setSavedCardId(c.id)}
                  />
                  <span className="text-ink">
                    💳 {c.alias ?? 'Kart'} {c.last4 ? `•••• ${c.last4}` : ''}
                  </span>
                </label>
              ))}
              <label className="flex items-center gap-2 text-sm">
                <input type="radio" name="savedcard" checked={savedCardId === null} onChange={() => setSavedCardId(null)} />
                <span className="text-ink">Yeni kart ile öde</span>
              </label>
            </>
          )}
          {savedCardId === null && (
            <label className="flex items-center gap-2 text-sm text-muted">
              <input type="checkbox" checked={saveCard} onChange={(e) => setSaveCard(e.target.checked)} />
              Kartımı sonraki siparişler için kaydet
            </label>
          )}
        </div>
      )}

      {error && <p className="mt-3 text-xs text-red-600">{error}</p>}

      <button
        onClick={submit}
        disabled={placing || !canSubmit}
        className="mt-4 w-full rounded-xl bg-brand-500 py-3.5 text-sm font-semibold text-white disabled:opacity-50"
        style={{ color: '#ffffff' }}
      >
        {placing ? 'Gönderiliyor…' : `Siparişi Tamamla · ${fmt.format(total)}`}
      </button>
    </div>
  );
}

function Field({ label, value, onChange, placeholder, textarea }: any) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs text-muted">{label}</span>
      {textarea ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          rows={2}
          className="w-full rounded-xl border border-line bg-canvas px-3.5 py-2.5 text-sm outline-none focus:border-brand-500 focus:bg-white"
        />
      ) : (
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full rounded-xl border border-line bg-canvas px-3.5 py-2.5 text-sm outline-none focus:border-brand-500 focus:bg-white"
        />
      )}
    </label>
  );
}

/** Native form POST to Tiko pay3d — card data goes browser→Tiko, never our server. */
function TikoCardForm({ form, fmt, total }: { form: TikoForm; fmt: Intl.NumberFormat; total: number }) {
  const stored = 'CardId' in form.fields;
  return (
    <div className="mx-auto max-w-md px-5 py-10">
      <h1 className="font-display text-xl font-semibold text-ink">Kart ile Öde · {fmt.format(total)}</h1>
      <p className="mt-1 text-sm text-muted">
        {stored
          ? 'Kayıtlı kartınızla güvenli ödeme yapılacak.'
          : 'Kart bilgileriniz doğrudan Tiko güvenli ödeme sayfasına gönderilir.'}
      </p>
      <form method="POST" action={form.url} className="mt-5 space-y-3">
        {Object.entries(form.fields).map(([k, v]) => (
          <input key={k} type="hidden" name={k} value={v} />
        ))}
        {!stored && (
          <>
            <CardField name="CardName" label="Kart Sahibi" placeholder="Ad Soyad" />
            <CardField name="CardNo" label="Kart Numarası" placeholder="0000 0000 0000 0000" inputMode="numeric" />
            <div className="grid grid-cols-3 gap-2">
              <CardField name="CardExpireMonth" label="Ay" placeholder="12" inputMode="numeric" />
              <CardField name="CardExpireYear" label="Yıl" placeholder="27" inputMode="numeric" />
              <CardField name="CardCvv" label="CVV" placeholder="123" inputMode="numeric" />
            </div>
          </>
        )}
        <button type="submit" className="w-full rounded-xl bg-brand-500 py-3.5 text-sm font-semibold text-white" style={{ color: '#ffffff' }}>
          Güvenli Öde
        </button>
      </form>
    </div>
  );
}

function CardField({ name, label, placeholder, inputMode }: { name: string; label: string; placeholder: string; inputMode?: 'numeric' }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs text-muted">{label}</span>
      <input
        name={name}
        required
        inputMode={inputMode}
        placeholder={placeholder}
        className="w-full rounded-xl border border-line bg-canvas px-3.5 py-2.5 text-sm outline-none focus:border-brand-500 focus:bg-white"
      />
    </label>
  );
}

function SuccessView({ order, method, fmt }: { order: any; method: string; fmt: Intl.NumberFormat }) {
  return (
    <div className="mx-auto max-w-md px-5 py-16 text-center">
      <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-sage-bg text-3xl">✓</div>
      <h1 className="mt-4 font-display text-2xl font-semibold text-ink">Siparişiniz alındı</h1>
      <p className="mt-1 text-sm text-muted">
        #{order.id} · {order.type === 'delivery' ? 'Adrese teslimat' : 'Gel-al'} · {fmt.format(Number(order.grand_total))}
      </p>
      <p className="mt-3 text-sm text-muted">
        {method === 'cod' ? 'Ödemeyi teslimatta yapacaksınız.' : 'Ödemeniz alındı, teşekkürler.'}
      </p>
    </div>
  );
}
