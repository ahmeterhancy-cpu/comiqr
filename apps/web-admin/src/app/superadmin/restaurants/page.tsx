'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Panel } from '@/components/superadmin-ui';
import { setSession } from '@/lib/auth';
import { useApi } from '@/lib/useApi';

export default function RestaurantsPage() {
  const { api, ready } = useApi();
  const router = useRouter();
  const [tenants, setTenants] = useState<any[]>([]);
  const [detail, setDetail] = useState<any | null>(null);

  const load = useCallback(async () => setTenants(await api.superTenants()), [api]);
  useEffect(() => {
    if (ready) load();
  }, [ready, load]);

  async function setStatus(t: any, status: string) {
    await api.superUpdateTenant(t.id, { status });
    load();
  }
  async function impersonate(t: any) {
    const res = await api.superImpersonate(t.id);
    setSession(res.token, res.user as any);
    router.replace('/dashboard');
  }
  async function openDetail(t: any) {
    setDetail(null);
    setDetail(await api.superTenantDetail(t.id));
  }

  return (
    <div className="space-y-4">
      {detail && (
        <Panel
          title={detail.name}
          right={
            <button onClick={() => setDetail(null)} className="text-xs text-muted">
              Kapat ×
            </button>
          }
        >
          <p className="text-xs text-muted">
            {detail.slug} · {detail.plan ?? '—'} · {detail.status}
          </p>
          <div className="mt-3 grid grid-cols-3 gap-3">
            <Metric label="Kullanıcı" value={detail.counts.users} />
            <Metric label="Şube" value={detail.counts.branches} />
            <Metric label="Sipariş" value={detail.counts.orders} />
          </div>
          {detail.subscription && (
            <p className="mt-3 text-xs text-muted">
              Abonelik: {detail.subscription.plan} · {detail.subscription.status}
            </p>
          )}
          <ul className="mt-3 divide-y divide-line text-sm">
            {detail.users.map((u: any) => (
              <li key={u.id} className="flex items-center justify-between py-1.5">
                <span className="text-ink">
                  {u.name} <span className="text-muted">· {u.email}</span>
                </span>
                <span className="text-xs text-muted">{u.role}</span>
              </li>
            ))}
          </ul>
        </Panel>
      )}

      <Panel title="İşletmeler">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
                <th className="py-2">İşletme</th>
                <th>Plan</th>
                <th>Durum</th>
                <th className="text-right">Kullanıcı</th>
                <th className="text-right">Şube</th>
                <th className="text-right">İşlem</th>
              </tr>
            </thead>
            <tbody>
              {tenants.map((t) => (
                <tr key={t.id} className="border-b border-line/60">
                  <td className="py-2.5">
                    <button onClick={() => openDetail(t)} className="text-left font-medium text-ink hover:text-brand-600">
                      {t.name}
                    </button>
                    <div className="text-xs text-muted">{t.slug}</div>
                  </td>
                  <td className="text-muted">{t.plan ?? '—'}</td>
                  <td>
                    <span
                      className={`rounded-md px-2 py-0.5 text-xs font-medium ${
                        t.status === 'suspended' ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-800'
                      }`}
                    >
                      {t.status}
                    </span>
                  </td>
                  <td className="text-right">{t.users}</td>
                  <td className="text-right">{t.branches}</td>
                  <td className="py-2.5 text-right">
                    <div className="flex justify-end gap-2">
                      {t.status === 'suspended' ? (
                        <button onClick={() => setStatus(t, 'active')} className="text-xs font-medium text-emerald-700">
                          Aktifleştir
                        </button>
                      ) : (
                        <button onClick={() => setStatus(t, 'suspended')} className="text-xs font-medium text-red-600">
                          Askıya al
                        </button>
                      )}
                      <button onClick={() => impersonate(t)} className="text-xs font-semibold text-brand-600">
                        Panele gir
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: any }) {
  return (
    <div className="rounded-lg bg-canvas p-2.5">
      <div className="text-xs text-muted">{label}</div>
      <div className="text-lg font-semibold text-ink">{value}</div>
    </div>
  );
}
