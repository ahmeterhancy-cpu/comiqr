'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Panel } from '@/components/superadmin-ui';
import { Input } from '@/components/ui';
import { setSession } from '@/lib/auth';
import { useApi } from '@/lib/useApi';

function relativeTime(iso?: string): string {
  if (!iso) return '';
  const rtf = new Intl.RelativeTimeFormat('tr', { numeric: 'auto' });
  const diff = (new Date(iso).getTime() - Date.now()) / 1000;
  const units: [Intl.RelativeTimeFormatUnit, number][] = [
    ['year', 31536000],
    ['month', 2592000],
    ['day', 86400],
    ['hour', 3600],
    ['minute', 60],
  ];
  for (const [unit, secs] of units) {
    if (Math.abs(diff) >= secs) return rtf.format(Math.round(diff / secs), unit);
  }
  return rtf.format(Math.round(diff), 'second');
}

export default function RestaurantsPage() {
  const { api, ready } = useApi();
  const router = useRouter();
  const [tenants, setTenants] = useState<any[]>([]);
  const [detail, setDetail] = useState<any | null>(null);
  const [q, setQ] = useState('');
  const [perPage, setPerPage] = useState(10);
  const [page, setPage] = useState(1);

  const load = useCallback(async () => setTenants(await api.superTenants()), [api]);
  useEffect(() => {
    if (ready) load();
  }, [ready, load]);

  const filtered = useMemo(() => {
    const term = q.trim().toLocaleLowerCase('tr');
    if (!term) return tenants;
    return tenants.filter((t) =>
      [t.name, t.slug, t.owner_name, t.address].some((v: string) => (v ?? '').toLocaleLowerCase('tr').includes(term)),
    );
  }, [tenants, q]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / perPage));
  const current = Math.min(page, pageCount);
  const rows = filtered.slice((current - 1) * perPage, current * perPage);

  async function setStatus(t: any, status: string) {
    await api.superUpdateTenant(t.id, { status });
    load();
  }
  async function impersonate(t: any) {
    const res = await api.superImpersonate(t.id);
    setSession(res.token, res.user as any);
    router.replace('/dashboard');
  }
  async function remove(t: any) {
    if (!confirm(`"${t.name}" işletmesi silinsin mi? (geri alınabilir arşivleme)`)) return;
    await api.superDeleteTenant(t.id);
    setDetail(null);
    load();
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

      <Panel
        title="İşletmeler"
        right={
          <div className="flex items-center gap-2">
            <select
              value={perPage}
              onChange={(e) => {
                setPerPage(Number(e.target.value));
                setPage(1);
              }}
              className="rounded-lg border border-line bg-white px-2 py-1.5 text-sm"
            >
              {[10, 25, 50].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
            <Input
              placeholder="Ara…"
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setPage(1);
              }}
              className="w-48"
            />
          </div>
        }
      >
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
                <th className="py-2">İşletme</th>
                <th>Sahip</th>
                <th>Plan</th>
                <th>Adres</th>
                <th>Oluşturma</th>
                <th className="text-right">İşlem</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((t) => (
                <tr key={t.id} className="border-b border-line/60">
                  <td className="py-3">
                    <div className="flex items-center gap-3">
                      <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-brand-100 text-sm font-bold text-brand-700">
                        {(t.name ?? '?').charAt(0).toLocaleUpperCase('tr')}
                      </div>
                      <div className="min-w-0">
                        <button
                          onClick={() => openDetail(t)}
                          className="block text-left font-medium text-ink hover:text-brand-600"
                        >
                          {t.name}
                        </button>
                        <span className="text-xs text-muted">#{t.slug}</span>
                        {t.status === 'suspended' && (
                          <span className="ml-1 rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-semibold text-red-700">
                            askıda
                          </span>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="text-muted">{t.owner_name ?? '—'}</td>
                  <td className="text-muted">{t.plan ?? '—'}</td>
                  <td className="max-w-[220px] truncate text-muted" title={t.address ?? ''}>
                    {t.address ?? '—'}
                  </td>
                  <td className="text-xs text-muted">{relativeTime(t.created_at)}</td>
                  <td className="py-3 text-right">
                    <div className="flex flex-col items-end gap-1">
                      <div className="flex gap-2">
                        <button onClick={() => impersonate(t)} className="text-xs font-semibold text-brand-600">
                          ↪ Giriş
                        </button>
                        <button onClick={() => remove(t)} className="text-xs font-medium text-red-600">
                          ✕ Sil
                        </button>
                      </div>
                      {t.status === 'suspended' ? (
                        <button onClick={() => setStatus(t, 'active')} className="text-[11px] text-emerald-700">
                          Aktifleştir
                        </button>
                      ) : (
                        <button onClick={() => setStatus(t, 'suspended')} className="text-[11px] text-muted">
                          Askıya al
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-4 text-sm text-muted">
                    Kayıt bulunamadı.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="mt-4 flex items-center justify-between text-xs text-muted">
          <span>
            {filtered.length} işletme · sayfa {current}/{pageCount}
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={current <= 1}
              className="rounded-md border border-line px-2.5 py-1 disabled:opacity-40"
            >
              Önceki
            </button>
            <button
              onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
              disabled={current >= pageCount}
              className="rounded-md border border-line px-2.5 py-1 disabled:opacity-40"
            >
              Sonraki
            </button>
          </div>
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
