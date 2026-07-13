'use client';

/**
 * Ultra POS kit (Faz 3) — the full-screen cashier's building blocks: numeric
 * keypad, product customizer, order discount, split/cash/room payment, table
 * map, open-tab recall, cash-drawer shift (Z-report) and a printable receipt.
 * Kept framework-light (plain state) and styled with the admin theme tokens.
 */
import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui';

export function money(n: number | string, currency = 'TRY'): string {
  return new Intl.NumberFormat('tr-TR', { style: 'currency', currency, maximumFractionDigits: 2 }).format(
    Number(n) || 0,
  );
}

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

// --- Shared shells --------------------------------------------------------

export function Modal({
  title,
  onClose,
  children,
  wide,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  wide?: boolean;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-slate-900/50 p-0 sm:items-center sm:p-4" onClick={onClose}>
      <div
        className={`max-h-[92vh] w-full overflow-y-auto rounded-t-3xl bg-surface shadow-2xl sm:rounded-3xl ${wide ? 'max-w-3xl' : 'max-w-md'}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 flex items-center justify-between border-b border-line bg-surface px-5 py-4">
          <h3 className="text-base font-bold text-ink">{title}</h3>
          <button onClick={onClose} className="grid h-8 w-8 place-items-center rounded-lg text-xl text-muted hover:bg-canvas">
            ×
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

export function Keypad({ onKey }: { onKey: (k: string) => void }) {
  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '00', '0', '⌫'];
  return (
    <div className="grid grid-cols-3 gap-2">
      {keys.map((k) => (
        <button
          key={k}
          onClick={() => onKey(k)}
          className="rounded-xl border border-line bg-white py-4 text-xl font-bold text-ink transition active:scale-95 active:bg-brand-50 hover:border-brand-300"
        >
          {k}
        </button>
      ))}
    </div>
  );
}

// --- Product customizer (variants + modifiers) ----------------------------

export function Customizer({
  product,
  currency,
  onClose,
  onAdd,
}: {
  product: any;
  currency: string;
  onClose: () => void;
  onAdd: (variant: any, ids: number[], names: string[]) => void;
}) {
  const variants = product.variants ?? [];
  const groups = product.modifier_groups ?? [];
  const [variantId, setVariantId] = useState<number | undefined>(
    variants.find((v: any) => v.is_default)?.id ?? variants[0]?.id,
  );
  const [selected, setSelected] = useState<Record<number, number[]>>({});

  const variant = variants.find((v: any) => v.id === variantId);
  const chosen = groups
    .flatMap((g: any) => (selected[g.id] ?? []).map((id: number) => g.modifiers.find((m: any) => m.id === id)))
    .filter(Boolean);
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
    <Modal title={product.name} onClose={onClose}>
      {variants.length > 0 && (
        <div className="mb-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Boyut</p>
          <div className="flex flex-wrap gap-2">
            {variants.map((v: any) => (
              <button
                key={v.id}
                onClick={() => setVariantId(v.id)}
                className={`rounded-xl px-4 py-2 text-sm font-medium transition ${
                  v.id === variantId ? 'bg-brand-500 text-white' : 'border border-line text-muted hover:border-brand-400'
                }`}
              >
                {v.name}
                {Number(v.price_delta) ? ` +${money(v.price_delta, currency)}` : ''}
              </button>
            ))}
          </div>
        </div>
      )}
      {groups.map((g: any) => (
        <div key={g.id} className="mb-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">
            {g.name} {g.is_required ? <span className="text-brand-600">• zorunlu</span> : ''}
          </p>
          <div className="flex flex-wrap gap-2">
            {g.modifiers.map((m: any) => (
              <button
                key={m.id}
                onClick={() => toggle(g, m.id)}
                className={`rounded-xl px-4 py-2 text-sm font-medium transition ${
                  (selected[g.id] ?? []).includes(m.id)
                    ? 'bg-brand-500 text-white'
                    : 'border border-line text-muted hover:border-brand-400'
                }`}
              >
                {m.name}
                {Number(m.price_delta) ? ` +${money(m.price_delta, currency)}` : ''}
              </button>
            ))}
          </div>
        </div>
      ))}
      <Button
        onClick={() => onAdd(variant, chosen.map((m: any) => m.id), chosen.map((m: any) => m.name))}
        disabled={missingRequired}
        className="mt-2 w-full py-3.5 text-base"
      >
        Sepete Ekle
      </Button>
    </Modal>
  );
}

// --- Order discount -------------------------------------------------------

export function DiscountModal({
  subtotal,
  currency,
  onClose,
  onApply,
}: {
  subtotal: number;
  currency: string;
  onClose: () => void;
  onApply: (type: 'percent' | 'amount', value: number, reason?: string) => void;
}) {
  const [type, setType] = useState<'percent' | 'amount'>('percent');
  const [value, setValue] = useState('');
  const [reason, setReason] = useState('');
  const preview =
    type === 'percent' ? round2((subtotal * Math.min(100, Number(value) || 0)) / 100) : Math.min(subtotal, Number(value) || 0);

  return (
    <Modal title="İndirim Uygula" onClose={onClose}>
      <div className="mb-4 grid grid-cols-2 gap-2">
        {(['percent', 'amount'] as const).map((t) => (
          <button
            key={t}
            onClick={() => { setType(t); setValue(''); }}
            className={`rounded-xl py-3 text-sm font-semibold transition ${
              type === t ? 'bg-brand-500 text-white' : 'border border-line text-muted'
            }`}
          >
            {t === 'percent' ? 'Yüzde (%)' : 'Tutar'}
          </button>
        ))}
      </div>
      <div className="mb-3 flex flex-wrap gap-2">
        {(type === 'percent' ? [5, 10, 15, 20, 25] : [10, 25, 50, 100]).map((q) => (
          <button
            key={q}
            onClick={() => setValue(String(q))}
            className="rounded-lg border border-line px-3 py-1.5 text-sm font-medium text-ink hover:border-brand-400"
          >
            {type === 'percent' ? `%${q}` : money(q, currency)}
          </button>
        ))}
      </div>
      <input
        value={value}
        onChange={(e) => setValue(e.target.value.replace(/[^0-9.]/g, ''))}
        inputMode="decimal"
        placeholder={type === 'percent' ? 'Yüzde' : 'Tutar'}
        className="mb-3 w-full rounded-xl border border-line px-4 py-3 text-2xl font-bold text-ink outline-none focus:border-brand-500"
      />
      <input
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="Sebep (opsiyonel)"
        className="mb-4 w-full rounded-xl border border-line px-4 py-2.5 text-sm outline-none focus:border-brand-500"
      />
      <div className="mb-4 flex items-center justify-between rounded-xl bg-canvas px-4 py-3 text-sm">
        <span className="text-muted">İndirim tutarı</span>
        <span className="text-lg font-bold text-brand-600">− {money(preview, currency)}</span>
      </div>
      <div className="flex gap-2">
        <Button variant="ghost" onClick={() => onApply('amount', 0)} className="flex-1">
          İndirimi Kaldır
        </Button>
        <Button onClick={() => onApply(type, Number(value) || 0, reason || undefined)} disabled={!value} className="flex-1">
          Uygula
        </Button>
      </div>
    </Modal>
  );
}

// --- Payment (split, cash change, tip, room charge) -----------------------

export function PaymentModal({
  order: initial,
  currency,
  canRoomCharge,
  api,
  onClose,
  onDone,
}: {
  order: any;
  currency: string;
  canRoomCharge: boolean;
  api: any;
  onClose: () => void;
  onDone: (order: any) => void;
}) {
  const [order, setOrder] = useState<any>(initial);
  const [amount, setAmount] = useState('');
  const [tip, setTip] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showRedeem, setShowRedeem] = useState(false);
  const [phone, setPhone] = useState('');
  const [points, setPoints] = useState('');
  const [redeemMsg, setRedeemMsg] = useState<string | null>(null);
  const [showItemSplit, setShowItemSplit] = useState(false);
  const [selItems, setSelItems] = useState<number[]>([]);
  const [method, setMethod] = useState<'cash' | 'card' | 'room'>('cash');
  const [tab, setTab] = useState<'full' | 'split'>('full');

  const grand = Number(order.grand_total);
  const paid = Number(order.paid_total ?? 0);
  const outstanding = round2(Math.max(0, grand - paid));
  const liveItems = (order.items ?? []).filter((i: any) => i.status !== 'cancelled');

  function toggleItem(item: any) {
    setSelItems((s) => {
      const next = s.includes(item.id) ? s.filter((x) => x !== item.id) : [...s, item.id];
      const sum = liveItems.filter((x: any) => next.includes(x.id)).reduce((a: number, x: any) => a + Number(x.line_total), 0);
      setAmount(next.length ? String(round2(Math.min(sum, outstanding))) : '');
      return next;
    });
  }
  const entered = Number(amount) || 0;
  const change = entered > outstanding ? round2(entered - outstanding) : 0;

  async function tender(gateway: 'cash' | 'card') {
    if (outstanding <= 0) {
      onDone(order); // nothing left to collect — don't post a zero payment
      return;
    }
    setBusy(true);
    setError(null);
    try {
      // Blank amount = pay the whole outstanding balance; a smaller amount splits.
      const charge = entered > 0 ? Math.min(entered, outstanding) : outstanding;
      const res = await api.posPay(order.id, gateway, {
        amount: charge,
        tip: Number(tip) || undefined,
      });
      setTip('');
      setAmount('');
      setOrder(res);
      if (res.payment_status === 'paid') onDone(res);
    } catch (e: any) {
      setError(e?.message ?? 'Tahsilat başarısız.');
    } finally {
      setBusy(false);
    }
  }

  async function chargeRoom() {
    setBusy(true);
    try {
      const res = await api.posChargeRoom(order.id);
      onDone(res);
    } catch (e: any) {
      setError(e?.message ?? 'İşlem başarısız.');
    } finally {
      setBusy(false);
    }
  }

  async function applyRedeem() {
    if (!phone || !points) return;
    setBusy(true);
    setRedeemMsg(null);
    try {
      const res = await api.posRedeem(order.id, { phone, points: Number(points) });
      setOrder(res);
      setPoints('');
      if (res.payment_status === 'paid') onDone(res);
      else setShowRedeem(false);
    } catch (e: any) {
      setRedeemMsg(e?.message ?? 'Puan kullanılamadı.');
    } finally {
      setBusy(false);
    }
  }

  async function onComplete() {
    if (method === 'room') return chargeRoom();
    return tender(method);
  }

  const quick = [outstanding, Math.ceil(outstanding / 50) * 50, Math.ceil(outstanding / 100) * 100, 200, 500].filter(
    (v, i, a) => v > 0 && a.indexOf(v) === i,
  );
  const methods = [
    { key: 'cash' as const, label: 'Nakit', icon: '💵', show: true },
    { key: 'card' as const, label: 'Kart', icon: '💳', show: true },
    { key: 'room' as const, label: canRoomCharge ? 'Odaya Yaz' : 'Açık Hesap', icon: '🧾', show: canRoomCharge },
  ].filter((m) => m.show);

  return (
    <Modal title="Ödeme Al" onClose={onClose}>
      <div className="mx-auto w-full max-w-md">
        {/* Order + total */}
        <div className="mb-4 flex items-center justify-between">
          <span className="flex items-center gap-1.5 text-sm font-semibold text-muted">🧾 Sipariş #{order.id}</span>
          <span className="text-2xl font-black text-brand-600">{money(outstanding, currency)}</span>
        </div>

        {/* Tabs: full / split */}
        <div className="mb-4 grid grid-cols-2 gap-2">
          <button
            onClick={() => setTab('full')}
            className={`rounded-xl py-2.5 text-sm font-bold transition ${tab === 'full' ? 'bg-brand-500 text-white' : 'bg-canvas text-muted hover:text-ink'}`}
            style={tab === 'full' ? { color: '#ffffff' } : undefined}
          >
            Tam Ödeme
          </button>
          <button
            onClick={() => setTab('split')}
            className={`rounded-xl py-2.5 text-sm font-bold transition ${tab === 'split' ? 'bg-slate-900 text-white' : 'bg-canvas text-muted hover:text-ink'}`}
            style={tab === 'split' ? { color: '#ffffff' } : undefined}
          >
            Böl
          </button>
        </div>

        {/* Payment methods */}
        <div className={`mb-4 grid gap-2 ${methods.length >= 3 ? 'grid-cols-3' : 'grid-cols-2'}`}>
          {methods.map((m) => (
            <button
              key={m.key}
              onClick={() => setMethod(m.key)}
              className={`flex flex-col items-center gap-1 rounded-xl border py-3 text-xs font-semibold transition ${
                method === m.key ? 'border-brand-500 bg-brand-50 text-brand-700 ring-1 ring-brand-200' : 'border-line text-muted hover:border-brand-300'
              }`}
            >
              <span className="text-lg">{m.icon}</span>
              {m.label}
            </button>
          ))}
        </div>

        {/* Amount display */}
        <div className="mb-3 rounded-xl border border-line px-4 py-3 text-center text-2xl font-black text-ink">
          {amount ? money(amount, currency) : <span className="text-muted/40">{money(0, currency)}</span>}
        </div>

        {/* Totals */}
        <div className="mb-3 space-y-1 text-sm">
          <div className="flex justify-between text-muted"><span>Toplam</span><span className="font-semibold text-ink">{money(grand, currency)}</span></div>
          <div className="flex justify-between text-muted"><span>Ödenen</span><span>{money(paid, currency)}</span></div>
          <div className="flex justify-between font-semibold text-red-600"><span>Kalan</span><span>{money(outstanding, currency)}</span></div>
          {change > 0 && (
            <div className="flex justify-between font-semibold text-emerald-600"><span>Para üstü</span><span>{money(change, currency)}</span></div>
          )}
        </div>

        {/* Split helpers */}
        {tab === 'split' && (
          <div className="mb-3 rounded-xl bg-canvas p-2.5 text-xs">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-muted">Eşit böl:</span>
              {[2, 3, 4].map((n) => (
                <button key={n} onClick={() => setAmount(String(round2(outstanding / n)))} className="rounded-lg border border-line bg-white px-2.5 py-1 font-semibold text-ink hover:border-brand-400">
                  {n} kişi
                </button>
              ))}
            </div>
            {liveItems.length > 1 && (
              <div className="mt-2">
                <button onClick={() => setShowItemSplit((v) => !v)} className="font-semibold text-brand-600">🍽️ Ürüne göre böl</button>
                {showItemSplit && (
                  <div className="mt-1.5 max-h-32 space-y-1 overflow-y-auto rounded-lg border border-line bg-white p-2">
                    {liveItems.map((i: any) => (
                      <label key={i.id} className="flex cursor-pointer items-center justify-between gap-2">
                        <span className="flex min-w-0 items-center gap-1.5">
                          <input type="checkbox" checked={selItems.includes(i.id)} onChange={() => toggleItem(i)} />
                          <span className="truncate">{i.quantity}× {i.product_name ?? `#${i.product_id}`}</span>
                        </span>
                        <span className="shrink-0 text-muted">{money(i.line_total, currency)}</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Quick amounts */}
        {quick.length > 0 && (
          <div className="mb-2 grid grid-cols-4 gap-2">
            {quick.slice(0, 4).map((q) => (
              <button key={q} onClick={() => setAmount(String(round2(q)))} className="rounded-lg border border-line py-2 text-xs font-semibold text-ink hover:border-brand-400">
                {money(q, currency)}
              </button>
            ))}
          </div>
        )}

        {/* Keypad */}
        <Keypad onKey={(k) => setAmount((a) => (k === '⌫' ? a.slice(0, -1) : k === '00' ? (a ? a + '00' : a) : a + k))} />

        {/* Tip + redeem (secondary) */}
        <div className="mt-2 flex items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-1.5">
            <span className="font-semibold text-muted">Bahşiş</span>
            <input
              value={tip}
              onChange={(e) => setTip(e.target.value.replace(/[^0-9.]/g, ''))}
              inputMode="decimal"
              placeholder="0"
              className="w-20 rounded-lg border border-line px-2 py-1 outline-none focus:border-brand-500"
            />
          </div>
          {!showRedeem && (
            <button onClick={() => setShowRedeem(true)} className="font-semibold text-brand-600">⭐ Puan Kullan</button>
          )}
        </div>
        {showRedeem && (
          <div className="mt-2 space-y-2 rounded-xl border border-line p-2.5 text-xs">
            <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Müşteri telefonu" className="w-full rounded-lg border border-line px-3 py-1.5 outline-none focus:border-brand-500" />
            <div className="flex gap-2">
              <input value={points} onChange={(e) => setPoints(e.target.value.replace(/[^0-9]/g, ''))} inputMode="numeric" placeholder="Puan" className="flex-1 rounded-lg border border-line px-3 py-1.5 outline-none focus:border-brand-500" />
              <Button onClick={applyRedeem} loading={busy} className="px-4 py-1.5 text-xs">Kullan</Button>
            </div>
            {redeemMsg && <p className="text-red-600">{redeemMsg}</p>}
            <p className="text-[10px] text-muted">1 puan = {money(1, currency)}</p>
          </div>
        )}

        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

        {/* Actions */}
        <div className="mt-4 grid grid-cols-2 gap-2">
          <button onClick={onClose} className="rounded-xl border border-line py-3 text-sm font-bold text-ink transition hover:bg-canvas">
            İptal
          </button>
          <Button onClick={onComplete} loading={busy} className="py-3 text-sm font-bold">
            {method === 'room' ? (canRoomCharge ? '🧾 Odaya Yaz' : 'Açık Hesap') : 'Ödemeyi Tamamla'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

// --- Refund ---------------------------------------------------------------

export function RefundModal({
  order,
  currency,
  api,
  onClose,
  onDone,
}: {
  order: any;
  currency: string;
  api: any;
  onClose: () => void;
  onDone: (order: any) => void;
}) {
  const collected = Number(order.paid_total ?? 0);
  const [amount, setAmount] = useState(String(collected));
  const [gateway, setGateway] = useState<'cash' | 'card'>('cash');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const amt = Math.min(collected, Number(amount) || 0);

  async function submit() {
    if (amt <= 0) return;
    setBusy(true);
    setError(null);
    try {
      const res = await api.posRefund(order.id, { amount: amt, gateway, reason: reason || undefined });
      onDone(res);
    } catch (e: any) {
      setError(e?.message ?? 'İade başarısız.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title="İade" onClose={onClose}>
      <div className="mb-4 flex items-center justify-between rounded-2xl border border-line bg-canvas px-4 py-3">
        <span className="text-sm text-muted">Tahsil edilen</span>
        <span className="text-2xl font-black text-ink">{money(collected, currency)}</span>
      </div>
      <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted">İade tutarı</label>
      <input
        value={amount}
        onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ''))}
        inputMode="decimal"
        className="mb-2 w-full rounded-xl border border-line px-4 py-3 text-2xl font-bold text-ink outline-none focus:border-brand-500"
      />
      <div className="mb-3 flex gap-2">
        {[collected / 2, collected].map((q, i) => (
          <button
            key={i}
            onClick={() => setAmount(String(round2(q)))}
            className="rounded-lg border border-line px-3 py-1.5 text-sm font-semibold text-ink hover:border-brand-400"
          >
            {i === 0 ? 'Yarısı' : 'Tamamı'} · {money(round2(q), currency)}
          </button>
        ))}
      </div>
      <div className="mb-3 grid grid-cols-2 gap-2">
        {(['cash', 'card'] as const).map((g) => (
          <button
            key={g}
            onClick={() => setGateway(g)}
            className={`rounded-xl py-2.5 text-sm font-semibold transition ${
              gateway === g ? 'bg-brand-500 text-white' : 'border border-line text-muted'
            }`}
          >
            {g === 'cash' ? '💵 Nakit iade' : '💳 Kart iade'}
          </button>
        ))}
      </div>
      <input
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="Sebep (opsiyonel)"
        className="mb-4 w-full rounded-xl border border-line px-4 py-2.5 text-sm outline-none focus:border-brand-500"
      />
      {error && <p className="mb-2 text-sm text-red-600">{error}</p>}
      <Button onClick={submit} loading={busy} disabled={amt <= 0} className="w-full bg-red-600 py-3.5 hover:bg-red-700">
        {money(amt, currency)} İade Et
      </Button>
    </Modal>
  );
}

// --- Table map ------------------------------------------------------------

export function TableMapModal({
  tables,
  onPick,
  onClose,
}: {
  tables: any[];
  onPick: (tableId: number | null) => void;
  onClose: () => void;
}) {
  const areas = useMemo(() => {
    const map = new Map<string, any[]>();
    for (const t of tables) {
      const area = t.area?.name ?? t.dining_area?.name ?? 'Salon';
      if (!map.has(area)) map.set(area, []);
      map.get(area)!.push(t);
    }
    return [...map.entries()];
  }, [tables]);

  return (
    <Modal title="Masa Seç" onClose={onClose} wide>
      <button
        onClick={() => onPick(null)}
        className="mb-4 w-full rounded-xl border border-dashed border-line py-3 text-sm font-semibold text-muted hover:border-brand-400"
      >
        🛍️ Gel-Al / Paket (masasız)
      </button>
      {areas.map(([area, ts]) => (
        <div key={area} className="mb-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">{area}</p>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
            {ts.map((t) => {
              const busy = t.has_open_session;
              return (
                <button
                  key={t.id}
                  onClick={() => onPick(t.id)}
                  className={`aspect-square rounded-xl border-2 text-sm font-bold transition active:scale-95 ${
                    busy
                      ? 'border-amber-300 bg-amber-50 text-amber-700'
                      : 'border-line bg-white text-ink hover:border-brand-400'
                  }`}
                >
                  <div>{t.code}</div>
                  <div className="mt-0.5 text-[10px] font-medium">{busy ? '● dolu' : 'boş'}</div>
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </Modal>
  );
}

// --- Recall open tabs -----------------------------------------------------

export function RecallDrawer({
  orders,
  currency,
  scope,
  onScope,
  onPick,
  onClose,
}: {
  orders: any[];
  currency: string;
  scope: 'open' | 'today';
  onScope: (s: 'open' | 'today') => void;
  onPick: (order: any) => void;
  onClose: () => void;
}) {
  const status = (o: any) =>
    o.payment_status === 'paid'
      ? 'ödendi'
      : o.payment_status === 'partially_paid'
        ? 'kısmi ödendi'
        : o.charged_to_room
          ? 'odaya yazıldı'
          : 'ödenmedi';

  return (
    <Modal title={`Adisyonlar (${orders.length})`} onClose={onClose}>
      <div className="mb-3 grid grid-cols-2 gap-2">
        {(['open', 'today'] as const).map((s) => (
          <button
            key={s}
            onClick={() => onScope(s)}
            className={`rounded-lg py-2 text-sm font-semibold transition ${
              scope === s ? 'bg-brand-500 text-white' : 'border border-line text-muted'
            }`}
          >
            {s === 'open' ? 'Açık' : 'Bugün (ödenenler)'}
          </button>
        ))}
      </div>
      {orders.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted">Adisyon yok.</p>
      ) : (
        <ul className="space-y-2">
          {orders.map((o) => (
            <li key={o.id}>
              <button
                onClick={() => onPick(o)}
                className="flex w-full items-center justify-between rounded-xl border border-line px-4 py-3 text-left transition hover:border-brand-400"
              >
                <div>
                  <div className="text-sm font-semibold text-ink">
                    {o.table_code ?? 'Gel-Al'}
                    <span className="ml-2 text-xs font-normal text-muted">#{o.id}</span>
                  </div>
                  <div className="text-xs text-muted">
                    {(o.items ?? []).filter((i: any) => i.status !== 'cancelled').length} ürün · {status(o)}
                  </div>
                </div>
                <span className="text-base font-bold text-ink">{money(o.grand_total, currency)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </Modal>
  );
}

// --- Kitchen (KDS) live view ----------------------------------------------

export function KdsPanel({
  branchId,
  api,
  productName,
  onClose,
}: {
  branchId: number | null;
  api: any;
  productName: (id: number) => string;
  onClose: () => void;
}) {
  const [orders, setOrders] = useState<any[]>([]);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!branchId) {
      setErr('Aktif şube yok.');
      return;
    }
    let alive = true;
    const load = () =>
      api
        .kdsOrders(branchId)
        .then((o: any[]) => alive && (setOrders(o), setErr(null)))
        .catch(() => alive && setErr('Mutfak siparişleri alınamadı (yetki gerekebilir).'));
    load();
    const id = setInterval(load, 4000); // live poll
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [api, branchId]);

  async function advance(item: any) {
    const next: Record<string, string> = { pending: 'preparing', preparing: 'ready', ready: 'served' };
    const to = next[item.status];
    if (!to) return;
    // Optimistic — the 4s poll reconciles.
    setOrders((os) => os.map((o) => ({ ...o, items: o.items.map((i: any) => (i.id === item.id ? { ...i, status: to } : i)) })));
    try {
      if (to === 'served') await api.kdsBump(item.id);
      else await api.kdsItemStatus(item.id, to);
    } catch {
      /* poll will restore true state */
    }
  }

  const btn: Record<string, { label: string; cls: string }> = {
    pending: { label: 'Hazırla →', cls: 'bg-amber-100 text-amber-700 hover:bg-amber-200' },
    preparing: { label: 'Hazır →', cls: 'bg-blue-100 text-blue-700 hover:bg-blue-200' },
    ready: { label: 'Servis ✓', cls: 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200' },
  };

  const active = orders
    .map((o) => ({ ...o, live: (o.items ?? []).filter((i: any) => !['cancelled', 'served'].includes(i.status)) }))
    .filter((o) => o.live.length > 0);

  return (
    <Modal title="Mutfak — Canlı Siparişler" onClose={onClose} wide>
      {err && <p className="mb-2 text-sm text-red-600">{err}</p>}
      {active.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted">Hazırlanacak sipariş yok.</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {active.map((o) => (
            <div key={o.id} className="rounded-2xl border border-line bg-canvas p-3">
              <div className="mb-2 flex items-center justify-between text-sm font-bold text-ink">
                <span>{o.table_code ? `Masa ${o.table_code}` : o.type === 'takeaway' ? 'Gel-Al' : 'Sipariş'} · #{o.id}</span>
              </div>
              <ul className="space-y-1.5">
                {o.live.map((i: any) => (
                  <li key={i.id} className="flex items-center justify-between gap-2 text-sm">
                    <span className="min-w-0 truncate text-ink">
                      <b>{i.quantity}×</b> {i.product_name ?? productName(i.product_id)}
                      {i.note ? <span className="text-muted"> · {i.note}</span> : ''}
                    </span>
                    <button
                      onClick={() => advance(i)}
                      className={`shrink-0 rounded-lg px-2.5 py-1 text-xs font-bold transition ${btn[i.status]?.cls ?? ''}`}
                    >
                      {btn[i.status]?.label ?? i.status}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}

// --- Cash-drawer shift (Z-report) -----------------------------------------

export function ShiftModal({
  shift,
  api,
  branchId,
  currency,
  onChange,
  onClose,
}: {
  shift: any | null;
  api: any;
  branchId: number | null;
  currency: string;
  onChange: (shift: any | null) => void;
  onClose: () => void;
}) {
  const [floatAmt, setFloatAmt] = useState('');
  const [counted, setCounted] = useState('');
  const [busy, setBusy] = useState(false);
  const [closed, setClosed] = useState<any | null>(null);

  async function openShift() {
    setBusy(true);
    try {
      const res = await api.posOpenShift({ opening_float: Number(floatAmt) || 0, branch_id: branchId ?? undefined });
      onChange(res);
    } finally {
      setBusy(false);
    }
  }

  async function closeShift() {
    setBusy(true);
    try {
      const res = await api.posCloseShift(shift.id, { counted_cash: Number(counted) || 0 });
      setClosed(res);
      onChange(null);
    } finally {
      setBusy(false);
    }
  }

  if (closed) {
    const over = Number(closed.over_short);
    return (
      <Modal title="Z Raporu — Vardiya Kapandı" onClose={onClose}>
        <ZReport report={closed} currency={currency} />
        <div className={`mt-3 rounded-xl px-4 py-3 text-center font-bold ${over === 0 ? 'bg-emerald-50 text-emerald-700' : over > 0 ? 'bg-blue-50 text-blue-700' : 'bg-red-50 text-red-700'}`}>
          {over === 0 ? 'Kasa tam ✓' : over > 0 ? `Fazla: ${money(over, currency)}` : `Açık: ${money(Math.abs(over), currency)}`}
        </div>
        <Button onClick={onClose} className="mt-4 w-full">Kapat</Button>
      </Modal>
    );
  }

  return (
    <Modal title="Kasa / Vardiya" onClose={onClose}>
      {!shift ? (
        <>
          <p className="mb-3 text-sm text-muted">Kasayı açılış bozuk parasıyla başlatın.</p>
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted">Açılış kasası</label>
          <input
            value={floatAmt}
            onChange={(e) => setFloatAmt(e.target.value.replace(/[^0-9.]/g, ''))}
            inputMode="decimal"
            placeholder="0"
            className="mb-4 w-full rounded-xl border border-line px-4 py-3 text-2xl font-bold text-ink outline-none focus:border-brand-500"
          />
          <Button onClick={openShift} loading={busy} className="w-full py-3.5">Vardiyayı Aç</Button>
        </>
      ) : (
        <>
          <ZReport report={shift} currency={currency} />
          <label className="mb-1.5 mt-4 block text-xs font-semibold uppercase tracking-wide text-muted">Sayılan nakit</label>
          <input
            value={counted}
            onChange={(e) => setCounted(e.target.value.replace(/[^0-9.]/g, ''))}
            inputMode="decimal"
            placeholder={String(shift.expected_cash)}
            className="mb-4 w-full rounded-xl border border-line px-4 py-3 text-2xl font-bold text-ink outline-none focus:border-brand-500"
          />
          <Button onClick={closeShift} loading={busy} disabled={!counted} className="w-full py-3.5">
            Vardiyayı Kapat (Z Raporu)
          </Button>
        </>
      )}
    </Modal>
  );
}

function ZReport({ report, currency }: { report: any; currency: string }) {
  const rows = [
    ['Açılış kasası', report.opening_float],
    ['Nakit satış', report.cash_sales],
    ['Kart satış', report.card_sales],
    ['Beklenen kasa', report.expected_cash],
  ] as const;
  return (
    <div className="space-y-1.5 rounded-2xl border border-line bg-canvas p-4">
      {rows.map(([label, val]) => (
        <div key={label} className="flex justify-between text-sm">
          <span className="text-muted">{label}</span>
          <span className="font-semibold text-ink">{money(val ?? 0, currency)}</span>
        </div>
      ))}
      <div className="flex justify-between border-t border-line pt-1.5 text-sm">
        <span className="text-muted">Sipariş</span>
        <span className="font-semibold text-ink">{report.orders_count}</span>
      </div>
    </div>
  );
}

// --- Receipt (print) ------------------------------------------------------

export function printReceipt(order: any, venueName: string, currency: string) {
  const lines = (order.items ?? [])
    .filter((i: any) => i.status !== 'cancelled')
    .map(
      (i: any) =>
        `<tr><td>${i.quantity}×</td><td>${i.product_name ?? '#' + i.product_id}${
          (i.modifiers ?? []).length ? ` <small>${i.modifiers.map((m: any) => m.name).join(', ')}</small>` : ''
        }</td><td style="text-align:right">${money(i.line_total, currency)}</td></tr>`,
    )
    .join('');
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>Fiş #${order.id}</title>
    <style>@page{size:80mm auto;margin:0} body{font:12px/1.45 monospace;width:80mm;max-width:80mm;margin:0 auto;padding:6px 8px;color:#000}
    h2{text-align:center;margin:0 0 4px} .muted{color:#666;text-align:center;font-size:11px}
    table{width:100%;border-collapse:collapse;margin:10px 0} td{padding:2px 0;vertical-align:top}
    .tot{border-top:1px dashed #999;margin-top:8px;padding-top:6px}
    .row{display:flex;justify-content:space-between} .big{font-size:16px;font-weight:bold}</style></head>
    <body><h2>${venueName}</h2><p class="muted">Fiş #${order.id} · ${new Date().toLocaleString('tr-TR')}</p>
    <table>${lines}</table>
    <div class="tot">
      <div class="row"><span>Ara toplam</span><span>${money(order.subtotal, currency)}</span></div>
      ${Number(order.discount_total) > 0 ? `<div class="row"><span>İndirim</span><span>-${money(order.discount_total, currency)}</span></div>` : ''}
      ${Number(order.tip_total) > 0 ? `<div class="row"><span>Bahşiş</span><span>${money(order.tip_total, currency)}</span></div>` : ''}
      <div class="row big"><span>TOPLAM</span><span>${money(order.grand_total, currency)}</span></div>
    </div>
    <p class="muted" style="margin-top:16px">Teşekkür ederiz · ComiQR</p>
    <script>window.print();setTimeout(()=>window.close(),300)</script></body></html>`;
  const w = window.open('', '_blank', 'width=360,height=640');
  if (w) {
    w.document.write(html);
    w.document.close();
  }
}
