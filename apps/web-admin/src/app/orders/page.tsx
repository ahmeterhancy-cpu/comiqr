'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { AdminShell } from '@/components/AdminShell';
import { Card } from '@/components/ui';
import { getActiveBranchId } from '@/lib/branch';
import { createEcho } from '@/lib/echo';
import { useApi } from '@/lib/useApi';

const NEXT: Record<string, { labelKey: string; to?: string; bump?: boolean }> = {
  pending: { labelKey: 'actionPrepare', to: 'preparing' },
  preparing: { labelKey: 'actionReady', to: 'ready' },
  ready: { labelKey: 'actionServe', bump: true },
};

export default function OrdersPage() {
  const t = useTranslations('orders');
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
      const bid = getActiveBranchId() ?? branches[0]?.id ?? null;
      setBranchId(bid);
      if (bid) refresh(bid);
    });
  }, [ready, api, refresh]);

  // Polling — reliable fallback when the Reverb WS server isn't reachable.
  useEffect(() => {
    if (!branchId) return;
    timer.current = setInterval(() => refresh(branchId), 4000);
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, [branchId, refresh]);

  // Live push via Reverb — instant KDS updates on new orders / status changes.
  useEffect(() => {
    if (!branchId) return;
    const echo = createEcho();
    if (!echo) return;
    const name = `branch.${branchId}.orders`;
    const onEvent = () => refresh(branchId);
    try {
      const channel = echo.private(name);
      channel.listen('.OrderPlaced', onEvent);
      channel.listen('.OrderItemStatusChanged', onEvent);
    } catch {
      /* WS unavailable — polling covers it */
    }
    return () => {
      try {
        echo.leave(name);
        echo.disconnect();
      } catch {
        /* ignore */
      }
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
    <AdminShell title={t('title')}>
      {orders.length === 0 ? (
        <Card>
          <p className="text-sm text-muted">{t('empty')}</p>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {orders.map((o) => (
            <Card key={o.order_id}>
              <div className="mb-2 flex items-center justify-between">
                <span className="font-bold text-ink">{t('orderNumber', { id: o.order_id })}</span>
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
                        {t(NEXT[it.status].labelKey)}
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
