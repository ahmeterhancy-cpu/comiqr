'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Brand, Button, Card } from '@/components/ui';
import { APP_NAME, createApi } from '@/lib/api';
import { setSession } from '@/lib/auth';
import { useApi } from '@/lib/useApi';

export default function SuperadminPage() {
  const { api, me, ready } = useApi();
  const router = useRouter();
  const [tenants, setTenants] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [tab, setTab] = useState<'tenants' | 'audit'>('tenants');

  const load = useCallback(async () => {
    const [ts, ls] = await Promise.all([api.superTenants(), api.superAuditLogs()]);
    setTenants(ts);
    setLogs(ls);
  }, [api]);

  useEffect(() => {
    if (!ready) return;
    if (me?.user.role !== 'superadmin') {
      router.replace('/dashboard');
      return;
    }
    load();
  }, [ready, me, router, load]);

  async function setStatus(t: any, status: string) {
    await api.superUpdateTenant(t.id, { status });
    load();
  }

  async function impersonate(t: any) {
    const res = await api.superImpersonate(t.id);
    setSession(res.token, res.user as any);
    router.replace('/dashboard');
  }

  if (!ready || me?.user.role !== 'superadmin') {
    return <div className="grid min-h-screen place-items-center text-sm text-muted">…</div>;
  }

  return (
    <div className="min-h-screen bg-canvas">
      <header className="border-b border-line bg-surface px-6 py-4">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <div className="flex items-center gap-3">
            <Brand name={APP_NAME} />
            <span className="rounded-full bg-ink px-2.5 py-0.5 text-xs font-semibold text-white">Superadmin</span>
          </div>
          <Button
            variant="ghost"
            onClick={() => {
              createApi().logout().catch(() => undefined);
              localStorage.clear();
              router.replace('/login');
            }}
          >
            Çıkış
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-5xl p-6">
        <div className="mb-5 flex gap-2">
          {(['tenants', 'audit'] as const).map((k) => (
            <button
              key={k}
              onClick={() => setTab(k)}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
                tab === k ? 'bg-brand-500 text-white' : 'border border-line bg-surface text-muted'
              }`}
            >
              {k === 'tenants' ? 'İşletmeler' : 'Denetim Kaydı'}
            </button>
          ))}
        </div>

        {tab === 'tenants' ? (
          <Card>
            <table className="w-full text-sm">
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
                      <div className="font-medium text-ink">{t.name}</div>
                      <div className="text-xs text-muted">{t.slug}</div>
                    </td>
                    <td className="text-muted">{t.plan ?? '—'}</td>
                    <td>
                      <span
                        className={`rounded-md px-2 py-0.5 text-xs font-medium ${
                          t.status === 'suspended'
                            ? 'bg-red-100 text-red-700'
                            : 'bg-emerald-100 text-emerald-800'
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
          </Card>
        ) : (
          <Card>
            <ul className="divide-y divide-line text-sm">
              {logs.map((l) => (
                <li key={l.id} className="flex items-center justify-between py-2.5">
                  <div>
                    <span className="font-medium text-ink">{l.action}</span>
                    <span className="ml-2 text-muted">{l.tenant ?? ''} {l.user ? `· ${l.user}` : ''}</span>
                  </div>
                  <span className="text-xs text-muted">{l.created_at ? new Date(l.created_at).toLocaleString() : ''}</span>
                </li>
              ))}
              {logs.length === 0 && <li className="py-4 text-muted">Kayıt yok.</li>}
            </ul>
          </Card>
        )}
      </main>
    </div>
  );
}
