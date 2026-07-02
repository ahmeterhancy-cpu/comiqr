'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { AdminShell } from '@/components/AdminShell';
import { Card } from '@/components/ui';
import { useApi } from '@/lib/useApi';

const NEXT: Record<string, { label: string; to?: string; bump?: boolean }> = {
  pending: { label: 'Hazırla', to: 'preparing' },
  preparing: { label: 'Hazır', to: 'ready' },
  ready: { label: 'Servis Et', bump: true },
};

export default function OrdersPage() {
  const { api, ready } = useApi();
  const [branchId, setBranchId] = useState<number | null>(null);
  const [orders, setOrders] = useState<any[]>([]);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const refresh = useCallback(
    async (bid: number) => {
      try {
        setOrders(await api.kdsOrders(bid));
      } catch {
        /* transient */
      }
    },
    [api],
  );

  useEffect(() => {
    if (!ready) return;
    api.adminBranches().then((branches) => {
      const bid = branches[0]?.id ?? null;
      setBranchId(bid);
      if (bid) refresh(bid);
    });
  }, [ready, api, refresh]);

  useEffect(() => {
    if (!branchId) return;
    timer.current = setInterval(() => refresh(branchId), 4000);
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, [branchId, refresh]);

  async function advance(item: any) {
    const step = NEXT[item.status];
    if (!step) return;
    if (step.bump) await api.kdsBump(item.id);
    else if (step.to) await api.kdsItemStatus(item.id, step.to);
    if (branchId) refresh(branchId);
  }

  return (
    <AdminShell title="Canlı Siparişler (Mutfak)">
      {orders.length === 0 ? (
        <Card>
          <p className="text-sm text-muted">Bekleyen aktif sipariş yok. Bir masadan sipariş verildiğinde burada belirir.</p>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {orders.map((o) => (
            <Card key={o.order_id}>
              <div className="mb-2 flex items-center justify-between">
                <span className="font-bold text-ink">Sipariş #{o.order_id}</span>
                <span className="rounded bg-canvas px-2 py-0.5 text-xs text-muted">{o.status}</span>
              </div>
              <ul className="space-y-2">
                {o.items.map((it: any) => (
                  <li key={it.id} className="flex items-center justify-between gap-2 rounded-lg border border-line px-3 py-2">
                    <span className="text-sm text-ink">
                      <b>{it.quantity}×</b> {it.product}
                    </span>
                    {NEXT[it.status] && (
                      <button
                        onClick={() => advance(it)}
                        className="rounded-md bg-brand-500 px-2.5 py-1 text-xs font-semibold text-white"
                      >
                        {NEXT[it.status].label}
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            </Card>
          ))}
        </div>
      )}
    </AdminShell>
  );
}
