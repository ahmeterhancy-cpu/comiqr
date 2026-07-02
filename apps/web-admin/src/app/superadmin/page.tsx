'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Brand, Button, Card, Input } from '@/components/ui';
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
        <TwoFactorSection api={api} enabled={!!me?.user.two_factor_enabled} />

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

function TwoFactorSection({ api, enabled }: { api: any; enabled: boolean }) {
  const [setup, setSetup] = useState<{ secret: string; otpauth_uri: string } | null>(null);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function begin() {
    setError(null);
    setBusy(true);
    try {
      setSetup(await api.enableTwoFactor());
    } catch {
      setError('2FA başlatılamadı.');
    } finally {
      setBusy(false);
    }
  }

  async function confirm() {
    setError(null);
    setBusy(true);
    try {
      await api.confirmTwoFactor(code.trim());
      window.location.reload();
    } catch {
      setError('Kod hatalı. Uygulamadaki güncel kodu girin.');
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    setError(null);
    setBusy(true);
    try {
      await api.disableTwoFactor(code.trim());
      window.location.reload();
    } catch {
      setError('Kod hatalı. Devre dışı bırakmak için güncel kodu girin.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="mb-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-ink">İki adımlı doğrulama (2FA)</h2>
          <p className="text-xs text-muted">
            {enabled ? 'Hesabınız TOTP ile korunuyor.' : 'Google Authenticator / Authy ile hesabınızı koruyun.'}
          </p>
        </div>
        <span
          className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
            enabled ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
          }`}
        >
          {enabled ? 'Aktif' : 'Kapalı'}
        </span>
      </div>

      {!enabled && !setup && (
        <Button className="mt-3" onClick={begin} disabled={busy}>
          {busy ? '…' : 'Etkinleştir'}
        </Button>
      )}

      {!enabled && setup && (
        <div className="mt-3 space-y-2 rounded-lg border border-line bg-canvas p-3">
          <p className="text-xs text-muted">
            Authenticator uygulamanıza bu anahtarı girin (veya otpauth bağlantısını QR olarak okutun), ardından
            oluşan 6 haneli kodu doğrulayın:
          </p>
          <code className="block break-all rounded bg-white px-2 py-1 font-mono text-sm text-ink">{setup.secret}</code>
          <div className="flex gap-2">
            <Input placeholder="6 haneli kod" value={code} onChange={(e) => setCode(e.target.value)} className="w-40" />
            <Button onClick={confirm} disabled={busy || code.trim().length < 6}>
              Doğrula
            </Button>
          </div>
        </div>
      )}

      {enabled && (
        <div className="mt-3 flex gap-2">
          <Input placeholder="Devre dışı için kod" value={code} onChange={(e) => setCode(e.target.value)} className="w-48" />
          <Button variant="ghost" onClick={disable} disabled={busy || code.trim().length < 6}>
            Devre dışı bırak
          </Button>
        </div>
      )}

      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
    </Card>
  );
}
