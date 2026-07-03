'use client';

import { useCallback, useEffect, useState } from 'react';
import type { HotelFolioRoom } from '@comiqr/shared-types';
import { AdminShell } from '@/components/AdminShell';
import { Button, Card } from '@/components/ui';
import { getActiveBranchId } from '@/lib/branch';
import { useApi } from '@/lib/useApi';

const SPOT: Record<string, { icon: string; noun: string }> = {
  room: { icon: '🛏️', noun: 'Oda' },
  sunbed: { icon: '⛱️', noun: 'Şezlong' },
};
const spot = (t?: string | null) => SPOT[t ?? ''] ?? { icon: '📍', noun: '' };

/**
 * Front-desk folio (Faz 3). Lists spots (hotel rooms / beach sunbeds) with open
 * "charge to folio" orders and settles one at check-out (paid as cash, session
 * closed). Reachable for hotel + beach verticals (AdminShell adds the nav entry).
 */
export default function HotelFolioPage() {
  const { api, me, ready } = useApi();
  const [rooms, setRooms] = useState<HotelFolioRoom[]>([]);
  const [loading, setLoading] = useState(true);
  const [settling, setSettling] = useState<number | null>(null);
  const currency = me?.tenant?.currency ?? '';

  const refresh = useCallback(async () => {
    try {
      const bid = getActiveBranchId() ?? undefined;
      setRooms(await api.hotelFolio(bid));
    } catch {
      /* transient */
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => {
    if (!ready) return;
    refresh();
    const t = setInterval(refresh, 8000);
    return () => clearInterval(t);
  }, [ready, refresh]);

  async function settle(room: HotelFolioRoom) {
    const s = spot(room.area_type);
    if (!window.confirm(`${s.noun} ${room.code}: folyo ${money(room.total, currency)} nakit tahsil edilip oturum kapatılsın mı?`)) return;
    setSettling(room.table_id);
    try {
      await api.settleRoom(room.table_id);
      await refresh();
    } catch {
      /* keep the row; a retry is safe (already-paid orders are skipped) */
    } finally {
      setSettling(null);
    }
  }

  const grandTotal = rooms.reduce((sum, r) => sum + Number(r.total || 0), 0);

  return (
    <AdminShell title="Folyo">
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <Card className="flex-1">
          <div className="text-xs font-medium text-muted">Açık folyo</div>
          <div className="mt-1 text-2xl font-bold text-ink">{rooms.length}</div>
        </Card>
        <Card className="flex-1">
          <div className="text-xs font-medium text-muted">Toplam açık folyo</div>
          <div className="mt-1 text-2xl font-bold text-ink">{money(grandTotal, currency)}</div>
        </Card>
      </div>

      {loading ? (
        <Card>Yükleniyor…</Card>
      ) : rooms.length === 0 ? (
        <Card>
          <div className="py-8 text-center text-muted">
            <div className="text-3xl">🧾</div>
            <p className="mt-2 text-sm">Açık folyo yok. Misafirler odaya/şezlonga sipariş yansıttıkça burada görünür.</p>
          </div>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {rooms.map((room) => (
            <Card key={room.table_id} className="flex flex-col">
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-lg font-bold text-ink">
                    {spot(room.area_type).icon} {spot(room.area_type).noun} {room.code}
                  </div>
                  {room.area && <div className="text-xs text-muted">{room.area}</div>}
                </div>
                <div className="rounded-full bg-brand-50 px-2.5 py-1 text-xs font-semibold text-brand-700">
                  {room.order_count} sipariş
                </div>
              </div>

              <ul className="mt-3 space-y-1.5 border-t border-line pt-3 text-sm">
                {room.orders.map((o) => (
                  <li key={o.id} className="flex items-center justify-between">
                    <span className="text-muted">
                      #{o.id} · {o.items_count} kalem
                      {o.placed_at ? ` · ${time(o.placed_at)}` : ''}
                    </span>
                    <span className="font-medium text-ink">{money(o.grand_total, currency)}</span>
                  </li>
                ))}
              </ul>

              <div className="mt-3 flex items-center justify-between border-t border-line pt-3">
                <span className="text-sm text-muted">Folyo</span>
                <span className="text-lg font-bold text-ink">{money(room.total, currency)}</span>
              </div>

              <Button className="mt-3 w-full" onClick={() => settle(room)} disabled={settling === room.table_id}>
                {settling === room.table_id ? 'Tahsil ediliyor…' : 'Tahsil Et & Çıkış'}
              </Button>
            </Card>
          ))}
        </div>
      )}
    </AdminShell>
  );
}

function money(v: number, currency: string): string {
  const n = Number(v || 0).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return currency ? `${n} ${currency}` : n;
}

function time(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}
