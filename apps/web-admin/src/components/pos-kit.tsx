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

  const grand = Number(order.grand_total);
  const paid = Number(order.paid_total ?? 0);
  const outstanding = round2(Math.max(0, grand - paid));
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

  const quick = [outstanding, Math.ceil(outstanding / 50) * 50, Math.ceil(outstanding / 100) * 100, 200, 500].filter(
    (v, i, a) => v > 0 && a.indexOf(v) === i,
  );

  return (
    <Modal title="Ödeme" onClose={onClose} wide>
      <div className="grid gap-5 sm:grid-cols-2">
        {/* Left: summary + quick cash */}
        <div>
          <div className="rounded-2xl border border-line bg-canvas p-4">
            <div className="flex items-baseline justify-between">
              <span className="text-sm text-muted">Kalan</span>
              <span className="text-3xl font-black text-ink">{money(outstanding, currency)}</span>
            </div>
            {paid > 0 && (
              <div className="mt-1 flex justify-between text-xs text-muted">
                <span>Toplam {money(grand, currency)}</span>
                <span>Ödenen {money(paid, currency)}</span>
              </div>
            )}
          </div>

          <p className="mb-2 mt-4 text-xs font-semibold uppercase tracking-wide text-muted">Alınan (nakit)</p>
          <div className="rounded-xl border border-line px-4 py-3 text-right text-3xl font-black text-ink">
            {amount ? money(amount, currency) : <span className="text-muted/50">{money(0, currency)}</span>}
          </div>
          {change > 0 && (
            <div className="mt-2 flex items-center justify-between rounded-xl bg-emerald-50 px-4 py-2.5 text-sm font-semibold text-emerald-700">
              <span>Para üstü</span>
              <span className="text-lg">{money(change, currency)}</span>
            </div>
          )}
          <div className="mt-3 flex flex-wrap gap-2">
            {quick.map((q) => (
              <button
                key={q}
                onClick={() => setAmount(String(round2(q)))}
                className="rounded-lg border border-line px-3 py-1.5 text-sm font-semibold text-ink hover:border-brand-400"
              >
                {money(q, currency)}
              </button>
            ))}
          </div>
          <div className="mt-3 flex items-center gap-2">
            <span className="text-xs font-semibold text-muted">Bahşiş</span>
            <input
              value={tip}
              onChange={(e) => setTip(e.target.value.replace(/[^0-9.]/g, ''))}
              inputMode="decimal"
              placeholder="0"
              className="w-24 rounded-lg border border-line px-3 py-1.5 text-sm outline-none focus:border-brand-500"
            />
          </div>
        </div>

        {/* Right: keypad + tenders */}
        <div>
          <Keypad
            onKey={(k) =>
              setAmount((a) => (k === '⌫' ? a.slice(0, -1) : k === '00' ? (a ? a + '00' : a) : a + k))
            }
          />
          {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
          <div className="mt-3 grid grid-cols-2 gap-2">
            <Button onClick={() => tender('cash')} loading={busy} className="py-4 text-base">
              💵 Nakit
            </Button>
            <Button onClick={() => tender('card')} loading={busy} className="py-4 text-base">
              💳 Kart
            </Button>
          </div>
          {canRoomCharge && (
            <Button variant="ghost" onClick={chargeRoom} loading={busy} className="mt-2 w-full py-3">
              🧾 Odaya / Şezlonga Yaz
            </Button>
          )}
          <p className="mt-2 text-center text-xs text-muted">
            Tutar boşsa tamamı tahsil edilir · küçük tutar = bölünmüş ödeme
          </p>
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
    <style>body{font:13px/1.5 monospace;max-width:300px;margin:12px auto;color:#111}
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
