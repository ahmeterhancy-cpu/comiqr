'use client';

import { useEffect, useMemo, useState } from 'react';
import { money } from './pos-kit';

/* ------------------------------------------------------------------ shared */

function Stat({ label, value, sub, tone = 'default' }: { label: string; value: string; sub?: string; tone?: 'default' | 'brand' | 'emerald' | 'amber' }) {
  const toneCls =
    tone === 'brand' ? 'text-brand-600' : tone === 'emerald' ? 'text-emerald-600' : tone === 'amber' ? 'text-amber-600' : 'text-ink';
  return (
    <div className="rounded-2xl border border-line bg-white p-4">
      <div className="text-xs font-semibold uppercase tracking-wide text-muted">{label}</div>
      <div className={`mt-1 text-2xl font-black ${toneCls}`}>{value}</div>
      {sub && <div className="mt-0.5 text-xs text-muted">{sub}</div>}
    </div>
  );
}

function ViewShell({ title, subtitle, right, children }: { title: string; subtitle?: string; right?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="flex min-w-0 flex-1 flex-col overflow-hidden rounded-2xl border border-line bg-white">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-3.5">
        <div>
          <h2 className="text-base font-extrabold tracking-tight text-ink">{title}</h2>
          {subtitle && <div className="text-[11px] text-muted">{subtitle}</div>}
        </div>
        {right}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-5">{children}</div>
    </section>
  );
}

const orderLabel = (o: any) => (o.table_code ? `🍽️ ${o.table_code}` : '🛍️ Gel-Al');
const timeOf = (o: any) => {
  try {
    return new Date(o.placed_at).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
};

/* ------------------------------------------------------------------ Özet */

export function SummaryView({ api, currency, branchId, onNewSale, onOpenShift }: { api: any; currency: string; branchId: number | null; onNewSale: () => void; onOpenShift: () => void }) {
  const [today, setToday] = useState<any[]>([]);
  const [open, setOpen] = useState<any[]>([]);
  const [shift, setShift] = useState<any | null>(null);

  useEffect(() => {
    api.posOrders({ scope: 'today', branch_id: branchId ?? undefined }).then(setToday).catch(() => undefined);
    api.posOrders({ scope: 'open', branch_id: branchId ?? undefined }).then(setOpen).catch(() => undefined);
    api.posShift(branchId ?? undefined).then(setShift).catch(() => undefined);
  }, [api, branchId]);

  const ciro = today.reduce((s, o) => s + Number(o.paid_total || 0), 0);
  const paidCount = today.filter((o) => o.payment_status === 'paid').length;

  return (
    <ViewShell
      title="Özet"
      subtitle="Bugünün POS durumu"
      right={<button onClick={onNewSale} className="rounded-xl bg-brand-500 px-4 py-2 text-sm font-bold text-white transition hover:bg-brand-600" style={{ color: '#fff' }}>＋ Yeni Satış</button>}
    >
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Bugünkü Ciro" value={money(ciro, currency)} sub={`${paidCount} ödenen sipariş`} tone="brand" />
        <Stat label="Sipariş" value={String(today.length)} sub="bugün" />
        <Stat label="Açık Adisyon" value={String(open.length)} sub="şu an açık" tone="amber" />
        <Stat
          label="Vardiya Kasası"
          value={shift ? money(shift.expected_cash, currency) : 'Kapalı'}
          sub={shift ? 'beklenen nakit' : 'vardiya açık değil'}
          tone={shift ? 'emerald' : 'default'}
        />
      </div>

      {!shift && (
        <button onClick={onOpenShift} className="mt-3 w-full rounded-xl border border-emerald-200 bg-emerald-50 py-2.5 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-100">
          🟢 Vardiya Aç
        </button>
      )}

      <h3 className="mb-2 mt-6 text-sm font-bold text-ink">Son Siparişler</h3>
      {today.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted">Bugün henüz sipariş yok.</p>
      ) : (
        <div className="space-y-1.5">
          {today.slice(0, 8).map((o) => (
            <div key={o.id} className="flex items-center justify-between rounded-xl border border-line px-3 py-2.5 text-sm">
              <span className="flex items-center gap-2">
                <b className="text-ink">#{o.id}</b>
                <span className="text-muted">{orderLabel(o)}</span>
                <span className="text-[11px] text-muted">{timeOf(o)}</span>
              </span>
              <span className="flex items-center gap-2">
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${o.payment_status === 'paid' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                  {o.payment_status === 'paid' ? 'Ödendi' : 'Açık'}
                </span>
                <b className="text-ink">{money(o.grand_total, currency)}</b>
              </span>
            </div>
          ))}
        </div>
      )}
    </ViewShell>
  );
}

/* ------------------------------------------------------------------ Siparişler */

export function OrdersView({ api, currency, branchId, onRecall }: { api: any; currency: string; branchId: number | null; onRecall: (o: any) => void }) {
  const [scope, setScope] = useState<'open' | 'today'>('open');
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api.posOrders({ scope, branch_id: branchId ?? undefined }).then(setOrders).catch(() => setOrders([])).finally(() => setLoading(false));
  }, [api, branchId, scope]);

  return (
    <ViewShell
      title="Siparişler"
      subtitle="Açık adisyonlar ve bugünün siparişleri"
      right={
        <div className="flex gap-1.5">
          {(['open', 'today'] as const).map((s) => (
            <button key={s} onClick={() => setScope(s)} className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${scope === s ? 'bg-brand-500 text-white' : 'bg-canvas text-muted hover:text-ink'}`} style={scope === s ? { color: '#fff' } : undefined}>
              {s === 'open' ? 'Açık' : 'Bugün'}
            </button>
          ))}
        </div>
      }
    >
      {loading ? (
        <p className="py-10 text-center text-sm text-muted">Yükleniyor…</p>
      ) : orders.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted">Sipariş yok.</p>
      ) : (
        <div className="space-y-2">
          {orders.map((o) => {
            const items = (o.items ?? []).filter((i: any) => i.status !== 'cancelled');
            return (
              <button key={o.id} onClick={() => onRecall(o)} className="flex w-full items-center justify-between gap-3 rounded-xl border border-line bg-white p-3 text-left transition hover:border-brand-400 hover:shadow-sm">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <b className="text-ink">#{o.id}</b>
                    <span className="text-sm text-muted">{orderLabel(o)}</span>
                    <span className="text-[11px] text-muted">{timeOf(o)}</span>
                  </div>
                  <div className="truncate text-[11px] text-muted">
                    {items.length} ürün{o.note ? ` · ${o.note}` : ''}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${o.payment_status === 'paid' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                    {o.payment_status === 'paid' ? 'Ödendi' : 'Açık'}
                  </span>
                  <b className="text-ink">{money(o.grand_total, currency)}</b>
                  <span className="text-brand-600">→</span>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </ViewShell>
  );
}

/* ------------------------------------------------------------------ Masalar */

export function TablesView({ api, tables, currency, branchId, onPickTable, onRecall }: { api: any; tables: any[]; currency: string; branchId: number | null; onPickTable: (id: number, code: string) => void; onRecall: (o: any) => void }) {
  const [openOrders, setOpenOrders] = useState<any[]>([]);
  useEffect(() => {
    api.posOrders({ scope: 'open', branch_id: branchId ?? undefined }).then(setOpenOrders).catch(() => undefined);
  }, [api, branchId]);

  const orderByCode = useMemo(() => {
    const m = new Map<string, any>();
    for (const o of openOrders) if (o.table_code) m.set(o.table_code, o);
    return m;
  }, [openOrders]);

  const free = tables.filter((t) => !t.has_open_session).length;

  return (
    <ViewShell title="Masalar" subtitle={`${tables.length} masa · ${free} boş`}>
      {tables.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted">Masa tanımlı değil.</p>
      ) : (
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-6">
          {tables.map((t) => {
            const occupied = !!t.has_open_session;
            const order = orderByCode.get(t.code);
            return (
              <button
                key={t.id}
                onClick={() => (occupied && order ? onRecall(order) : onPickTable(t.id, t.code))}
                className={`flex aspect-square flex-col items-center justify-center gap-1 rounded-2xl border-2 p-2 text-center transition hover:shadow-md ${
                  occupied ? 'border-amber-300 bg-amber-50 text-amber-800' : 'border-emerald-200 bg-emerald-50 text-emerald-700'
                }`}
              >
                <span className="text-2xl">{occupied ? '🍽️' : '🪑'}</span>
                <b className="text-sm">{t.code}</b>
                <span className="text-[10px] font-semibold">
                  {occupied ? (order ? money(order.grand_total, currency) : 'Dolu') : 'Boş'}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </ViewShell>
  );
}

/* ------------------------------------------------------------------ Müşteriler */

export function CustomersView({ api, currency }: { api: any; currency: string }) {
  const [customers, setCustomers] = useState<any[]>([]);
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .adminCustomers()
      .then((d: any) => setCustomers(Array.isArray(d) ? d : d?.data ?? []))
      .catch(() => setCustomers([]))
      .finally(() => setLoading(false));
  }, [api]);

  const shown = customers.filter((c) => {
    const s = q.trim().toLocaleLowerCase('tr');
    return !s || `${c.name ?? ''} ${c.phone ?? ''} ${c.email ?? ''}`.toLocaleLowerCase('tr').includes(s);
  });

  return (
    <ViewShell
      title="Müşteriler"
      subtitle="Sadakat & iletişim"
      right={
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="İsim / telefon ara…" className="w-48 rounded-lg border border-line bg-canvas px-3 py-1.5 text-sm outline-none focus:border-brand-500" />
      }
    >
      {loading ? (
        <p className="py-10 text-center text-sm text-muted">Yükleniyor…</p>
      ) : shown.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted">{customers.length === 0 ? 'Henüz müşteri yok.' : 'Eşleşen müşteri yok.'}</p>
      ) : (
        <div className="space-y-1.5">
          {shown.map((c) => (
            <div key={c.id} className="flex items-center justify-between gap-3 rounded-xl border border-line px-3 py-2.5">
              <div className="flex min-w-0 items-center gap-2.5">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-brand-100 text-sm font-bold text-brand-700">{(c.name ?? '?').charAt(0).toUpperCase()}</span>
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold text-ink">{c.name ?? 'İsimsiz'}</div>
                  <div className="truncate text-[11px] text-muted">{c.phone ?? c.email ?? ''}</div>
                </div>
              </div>
              {c.points != null && <span className="shrink-0 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-bold text-amber-700">⭐ {c.points}</span>}
            </div>
          ))}
        </div>
      )}
    </ViewShell>
  );
}

/* ------------------------------------------------------------------ Raporlar */

export function ReportsView({ api, currency, branchId }: { api: any; currency: string; branchId: number | null }) {
  const [today, setToday] = useState<any[]>([]);
  const [shift, setShift] = useState<any | null>(null);

  useEffect(() => {
    api.posOrders({ scope: 'today', branch_id: branchId ?? undefined }).then(setToday).catch(() => undefined);
    api.posShift(branchId ?? undefined).then(setShift).catch(() => undefined);
  }, [api, branchId]);

  const paid = today.filter((o) => o.payment_status === 'paid');
  const ciro = paid.reduce((s, o) => s + Number(o.paid_total || 0), 0);
  const avg = paid.length ? ciro / paid.length : 0;
  const dineIn = today.filter((o) => o.table_code).length;
  const takeaway = today.length - dineIn;

  const topProducts = useMemo(() => {
    const m = new Map<string, { qty: number; total: number }>();
    for (const o of today) {
      for (const i of o.items ?? []) {
        if (i.status === 'cancelled') continue;
        const name = i.product_name ?? `#${i.product_id}`;
        const cur = m.get(name) ?? { qty: 0, total: 0 };
        cur.qty += Number(i.quantity || 0);
        cur.total += Number(i.line_total || 0);
        m.set(name, cur);
      }
    }
    return [...m.entries()].sort((a, b) => b[1].qty - a[1].qty).slice(0, 8);
  }, [today]);

  return (
    <ViewShell title="Raporlar" subtitle="Bugünün satış özeti (POS)">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Ciro" value={money(ciro, currency)} sub={`${paid.length} ödenen`} tone="brand" />
        <Stat label="Sipariş" value={String(today.length)} sub={`${dineIn} masa · ${takeaway} gel-al`} />
        <Stat label="Ortalama Fiş" value={money(avg, currency)} />
        <Stat label="Vardiya Kasası" value={shift ? money(shift.expected_cash, currency) : '—'} sub={shift ? 'beklenen nakit' : 'vardiya kapalı'} tone={shift ? 'emerald' : 'default'} />
      </div>

      <h3 className="mb-2 mt-6 text-sm font-bold text-ink">En Çok Satan Ürünler</h3>
      {topProducts.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted">Bugün satış yok.</p>
      ) : (
        <div className="overflow-hidden rounded-xl border border-line">
          {topProducts.map(([name, s], idx) => (
            <div key={name} className={`flex items-center justify-between px-4 py-2.5 text-sm ${idx % 2 ? 'bg-canvas' : 'bg-white'}`}>
              <span className="flex min-w-0 items-center gap-2">
                <span className="w-5 text-center text-xs font-bold text-muted">{idx + 1}</span>
                <span className="truncate font-medium text-ink">{name}</span>
              </span>
              <span className="flex shrink-0 items-center gap-4">
                <span className="text-muted">{s.qty} adet</span>
                <b className="text-ink">{money(s.total, currency)}</b>
              </span>
            </div>
          ))}
        </div>
      )}
    </ViewShell>
  );
}
