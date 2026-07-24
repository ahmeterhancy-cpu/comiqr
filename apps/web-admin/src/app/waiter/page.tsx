'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { BrandLogo } from '@/components/BrandLogo';
import { clearSession, getToken } from '@/lib/auth';
import { createApi } from '@/lib/api';
import { useApi } from '@/lib/useApi';

type Table = {
  table_id: number;
  code: string;
  state: 'occupied' | 'free';
  session_id: number | null;
  order_status: string | null;
  waiter_called: boolean;
  bill_requested: boolean;
};
type ServiceCall = { session_id: number; table_code: string | null; waiter_called: boolean; bill_requested: boolean };
type ReadyItem = { order_item_id: number; order_id: number; product: string | null; quantity: number };

/**
 * Mobile-first waiter floor board (M10). Polls tables + notifications every few
 * seconds; the waiter acknowledges service calls and marks ready items served.
 * Standalone (no admin shell) — its own login at /waiter/login.
 */
export default function WaiterPage() {
  const t = useTranslations('waiter');
  const { api, me, ready } = useApi('/waiter/login');
  const router = useRouter();

  const [tables, setTables] = useState<Table[]>([]);
  const [calls, setCalls] = useState<ServiceCall[]>([]);
  const [readyItems, setReadyItems] = useState<ReadyItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<number | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [tb, notif] = await Promise.all([api.waiterTables(), api.waiterNotifications()]);
      setTables(tb);
      setCalls(notif.service_calls ?? []);
      setReadyItems(notif.ready_items ?? []);
      setErr(null);
    } catch (e: any) {
      // 402 = plan lacks waiter_app; 403 = wrong role.
      setErr(e?.status === 402 ? t('planLocked') : e?.status === 403 ? t('noAccess') : t('loadError'));
    } finally {
      setLoading(false);
    }
  }, [api, t]);

  useEffect(() => {
    if (!ready) return;
    load();
    const id = setInterval(load, 5000);
    return () => clearInterval(id);
  }, [ready, load]);

  async function ack(sessionId: number) {
    setBusy(sessionId);
    try {
      await api.waiterAck(sessionId);
      await load();
    } finally {
      setBusy(null);
    }
  }
  async function serve(itemId: number) {
    setBusy(itemId);
    try {
      await api.waiterServed(itemId);
      await load();
    } finally {
      setBusy(null);
    }
  }
  function logout() {
    createApi(getToken()).logout().catch(() => undefined);
    clearSession();
    router.replace('/waiter/login');
  }

  const occupied = useMemo(() => tables.filter((x) => x.state === 'occupied').length, [tables]);
  const notifCount = calls.length + readyItems.length;

  if (!ready) {
    return <div className="grid min-h-screen place-items-center bg-slate-50 text-sm text-muted">…</div>;
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="sticky top-0 z-20 flex items-center justify-between gap-2 border-b border-line bg-white px-4 py-3 shadow-sm">
        <div className="flex items-center gap-2.5">
          <BrandLogo className="h-6 w-auto" />
          <div className="leading-tight">
            <p className="text-sm font-bold text-ink">{t('title')}</p>
            <p className="text-[11px] text-muted">{me?.user?.name}</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={load}
            aria-label={t('refresh')}
            className="grid h-9 w-9 place-items-center rounded-full text-muted transition hover:bg-slate-100 hover:text-ink"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 1 1-3-6.7L21 8M21 3v5h-5" /></svg>
          </button>
          <button
            type="button"
            onClick={logout}
            className="rounded-full border border-line px-3 py-1.5 text-xs font-semibold text-muted transition hover:text-ink"
          >
            {t('logout')}
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-md px-4 pb-10 pt-4">
        {err ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-6 text-center text-sm text-amber-800">{err}</div>
        ) : (
          <>
            {/* Notifications */}
            <section>
              <div className="mb-2 flex items-center gap-2">
                <h2 className="text-[13px] font-bold uppercase tracking-wide text-muted">{t('notifications')}</h2>
                {notifCount > 0 && (
                  <span className="grid h-5 min-w-5 place-items-center rounded-full bg-red-500 px-1.5 text-[11px] font-bold text-white">{notifCount}</span>
                )}
              </div>

              {loading && tables.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted">{t('loading')}</p>
              ) : notifCount === 0 ? (
                <p className="rounded-xl border border-dashed border-line bg-white py-6 text-center text-sm text-muted">{t('allClear')}</p>
              ) : (
                <div className="space-y-2">
                  {calls.map((cInfo) => (
                    <div key={`c${cInfo.session_id}`} className="flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-3">
                      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-amber-500 text-base text-white">{cInfo.bill_requested && !cInfo.waiter_called ? '🧾' : '🔔'}</span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-bold text-amber-900">{cInfo.table_code}</p>
                        <p className="text-[11px] text-amber-700">
                          {cInfo.waiter_called && cInfo.bill_requested ? t('callAndBill') : cInfo.bill_requested ? t('billRequested') : t('waiterCalled')}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => ack(cInfo.session_id)}
                        disabled={busy === cInfo.session_id}
                        className="shrink-0 rounded-lg bg-amber-600 px-3 py-2 text-xs font-bold text-white transition active:scale-95 disabled:opacity-50"
                      >
                        {t('acknowledge')}
                      </button>
                    </div>
                  ))}
                  {readyItems.map((it) => (
                    <div key={`r${it.order_item_id}`} className="flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-3">
                      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-emerald-500 text-base text-white">🍽️</span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-emerald-900">
                          {it.quantity}× {it.product ?? t('item')}
                        </p>
                        <p className="text-[11px] text-emerald-700">{t('readyToServe')}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => serve(it.order_item_id)}
                        disabled={busy === it.order_item_id}
                        className="shrink-0 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white transition active:scale-95 disabled:opacity-50"
                      >
                        {t('markServed')}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Floor board */}
            <section className="mt-6">
              <div className="mb-2 flex items-baseline justify-between">
                <h2 className="text-[13px] font-bold uppercase tracking-wide text-muted">{t('floor')}</h2>
                <span className="text-[11px] text-muted">{t('occupiedOfTotal', { occupied, total: tables.length })}</span>
              </div>
              {tables.length === 0 ? (
                <p className="rounded-xl border border-dashed border-line bg-white py-6 text-center text-sm text-muted">{t('noTables')}</p>
              ) : (
                <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-4">
                  {tables.map((tb) => {
                    const flagged = tb.waiter_called || tb.bill_requested;
                    return (
                      <div
                        key={tb.table_id}
                        className={`relative flex aspect-square flex-col items-center justify-center gap-1 rounded-2xl border-2 p-2 text-center ${
                          flagged
                            ? 'border-amber-300 bg-amber-50 text-amber-800'
                            : tb.state === 'occupied'
                              ? 'border-slate-300 bg-white text-ink'
                              : 'border-emerald-200 bg-emerald-50 text-emerald-700'
                        }`}
                      >
                        {flagged && <span className="absolute right-1.5 top-1.5 h-2.5 w-2.5 animate-pulse rounded-full bg-red-500" />}
                        <span className="text-xl">{tb.state === 'occupied' ? '🍽️' : '🪑'}</span>
                        <b className="text-sm">{tb.code}</b>
                        <span className="text-[10px] font-semibold">{tb.state === 'occupied' ? t('occupied') : t('free')}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          </>
        )}
      </main>
    </div>
  );
}
