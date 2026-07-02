'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { LineChart, Panel, StatCard } from '@/components/superadmin-ui';
import { useApi } from '@/lib/useApi';

const nf = (n: number) => Number(n ?? 0).toLocaleString('tr-TR');

export default function SuperadminDashboard() {
  const { api, ready } = useApi();
  const [o, setO] = useState<any | null>(null);

  useEffect(() => {
    if (ready) api.superOverview().then(setO).catch(() => setO(null));
  }, [ready, api]);

  if (!o) return <p className="text-sm text-muted">Yükleniyor…</p>;

  const cur = o.currency ?? 'TRY';

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        <StatCard
          tone="light"
          label="Toplam İşletme"
          value={String(o.tenants.total)}
          sub={`${o.tenants.active} aktif · ${o.tenants.trialing} deneme · ${o.tenants.suspended} askıda`}
          icon={<IconStore />}
        />
        <StatCard
          tone="indigo"
          label="Toplam Kullanıcı"
          value={nf(o.users_total)}
          sub={`${nf(o.customers_total)} müşteri kaydı`}
          icon={<IconUsers />}
        />
        <StatCard
          tone="blue"
          label="Toplam Gelir"
          value={`${nf(o.revenue)} ${cur}`}
          sub={`MRR ${nf(o.mrr)} ${cur}`}
          icon={<IconCash />}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="İşletme İstatistikleri">
          <LineChart series={o.restaurants_series} color="#4f46e5" />
        </Panel>
        <Panel title="Haftalık Kullanıcılar">
          <LineChart series={o.users_series} color="#0ea5e9" />
        </Panel>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Son 5 İşletme">
          <ul className="divide-y divide-line">
            {o.recent_restaurants.map((r: any) => (
              <li key={r.id} className="flex items-center justify-between py-2.5">
                <div className="min-w-0">
                  <Link href="/superadmin/restaurants" className="font-medium text-ink hover:text-brand-600">
                    {r.name}
                  </Link>
                  <div className="text-xs text-muted">
                    {r.slug} · {r.status}
                  </div>
                </div>
                <span className="shrink-0 text-xs text-muted">
                  {r.created_at ? new Date(r.created_at).toLocaleDateString() : ''}
                </span>
              </li>
            ))}
            {o.recent_restaurants.length === 0 && <li className="py-3 text-sm text-muted">Kayıt yok.</li>}
          </ul>
        </Panel>

        <Panel title="Son Kayıt Olanlar">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
                <th className="py-2">İsim</th>
                <th>E-posta</th>
                <th className="text-right">Tarih</th>
              </tr>
            </thead>
            <tbody>
              {o.recent_users.map((u: any) => (
                <tr key={u.id} className="border-b border-line/60">
                  <td className="py-2.5">
                    <div className="font-medium text-ink">{u.name}</div>
                    <div className="text-xs text-muted">{u.tenant ?? '—'}</div>
                  </td>
                  <td className="text-muted">{u.email}</td>
                  <td className="text-right text-xs text-muted">
                    {u.created_at ? new Date(u.created_at).toLocaleDateString() : ''}
                  </td>
                </tr>
              ))}
              {o.recent_users.length === 0 && (
                <tr>
                  <td colSpan={3} className="py-3 text-sm text-muted">
                    Kayıt yok.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </Panel>
      </div>
    </div>
  );
}

function IconStore() {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9l1.5-5h15L21 9M4 9v11h16V9M4 9h16M9 20v-5h6v5" />
    </svg>
  );
}
function IconUsers() {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 19v-1a4 4 0 00-4-4H7a4 4 0 00-4 4v1M8.5 10a3 3 0 100-6 3 3 0 000 6zM17 19v-1a4 4 0 00-3-3.87" />
    </svg>
  );
}
function IconCash() {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 6h18v12H3zM12 12a2 2 0 100-4 2 2 0 000 4zM6 8v8M18 8v8" />
    </svg>
  );
}
