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
  const [overview, setOverview] = useState<any | null>(null);
  const [plans, setPlans] = useState<any[]>([]);
  const [detail, setDetail] = useState<any | null>(null);
  const [tab, setTab] = useState<'tenants' | 'plans' | 'users' | 'audit'>('tenants');

  const load = useCallback(async () => {
    const [ts, ls, ov, pl] = await Promise.all([
      api.superTenants(),
      api.superAuditLogs(),
      api.superOverview(),
      api.superPlans(),
    ]);
    setTenants(ts);
    setLogs(ls);
    setOverview(ov);
    setPlans(pl);
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

  async function openDetail(t: any) {
    setDetail(null);
    setDetail(await api.superTenantDetail(t.id));
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
        {overview && <OverviewCards o={overview} />}

        <TwoFactorSection api={api} enabled={!!me?.user.two_factor_enabled} />

        <div className="mb-5 flex gap-2">
          {(
            [
              ['tenants', 'İşletmeler'],
              ['plans', 'Planlar'],
              ['users', 'Kullanıcılar'],
              ['audit', 'Denetim Kaydı'],
            ] as const
          ).map(([k, label]) => (
            <button
              key={k}
              onClick={() => setTab(k)}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
                tab === k ? 'bg-brand-500 text-white' : 'border border-line bg-surface text-muted'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {tab === 'tenants' && (
          <>
            {detail && <TenantDetailCard detail={detail} onClose={() => setDetail(null)} />}
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
                        <button onClick={() => openDetail(t)} className="text-left font-medium text-ink hover:text-brand-600">
                          {t.name}
                        </button>
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
          </>
        )}

        {tab === 'plans' && <PlansPanel plans={plans} api={api} onChanged={load} />}

        {tab === 'users' && <UsersPanel api={api} />}

        {tab === 'audit' && (
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

function OverviewCards({ o }: { o: any }) {
  const cur = o.currency ?? 'TRY';
  const cards: [string, string, string][] = [
    ['İşletme', String(o.tenants.total), `${o.tenants.active} aktif · ${o.tenants.trialing} deneme · ${o.tenants.suspended} askıda`],
    ['MRR', `${Number(o.mrr).toLocaleString()} ${cur}`, 'aylık yinelenen gelir'],
    ['Sipariş', String(o.orders), 'platform toplamı'],
    ['Ciro', `${Number(o.revenue).toLocaleString()} ${cur}`, 'ödenmiş'],
  ];
  return (
    <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map(([label, value, sub]) => (
        <div key={label} className="rounded-xl border border-line bg-surface p-4">
          <div className="text-xs font-medium uppercase tracking-wide text-muted">{label}</div>
          <div className="mt-1 text-xl font-semibold text-ink">{value}</div>
          <div className="mt-0.5 text-xs text-muted">{sub}</div>
        </div>
      ))}
    </div>
  );
}

function TenantDetailCard({ detail, onClose }: { detail: any; onClose: () => void }) {
  return (
    <Card className="mb-4 border-brand-200">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-base font-semibold text-ink">{detail.name}</h3>
          <p className="text-xs text-muted">
            {detail.slug} · {detail.plan ?? '—'} · {detail.status}
          </p>
        </div>
        <button onClick={onClose} className="text-xs text-muted">
          Kapat ×
        </button>
      </div>
      <div className="mt-3 grid grid-cols-3 gap-3">
        <Metric label="Kullanıcı" value={detail.counts.users} />
        <Metric label="Şube" value={detail.counts.branches} />
        <Metric label="Sipariş" value={detail.counts.orders} />
      </div>
      {detail.subscription && (
        <p className="mt-3 text-xs text-muted">
          Abonelik: {detail.subscription.plan} · {detail.subscription.status}
          {detail.subscription.current_period_end
            ? ` · bitiş ${new Date(detail.subscription.current_period_end).toLocaleDateString()}`
            : ''}
        </p>
      )}
      <div className="mt-3">
        <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted">Kullanıcılar</p>
        <ul className="divide-y divide-line text-sm">
          {detail.users.map((u: any) => (
            <li key={u.id} className="flex items-center justify-between py-1.5">
              <span className="text-ink">
                {u.name} <span className="text-muted">· {u.email}</span>
              </span>
              <span className="text-xs text-muted">
                {u.role}
                {u.last_login_at ? ` · ${new Date(u.last_login_at).toLocaleDateString()}` : ''}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </Card>
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

function PlansPanel({ plans, api, onChanged }: { plans: any[]; api: any; onChanged: () => void }) {
  return (
    <Card>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
            <th className="py-2">Plan</th>
            <th className="text-right">Aylık</th>
            <th className="text-right">Yıllık</th>
            <th className="text-right">İşletme</th>
            <th className="text-right">Durum</th>
          </tr>
        </thead>
        <tbody>
          {plans.map((p) => (
            <PlanRow key={p.id} p={p} api={api} onChanged={onChanged} />
          ))}
        </tbody>
      </table>
    </Card>
  );
}

function PlanRow({ p, api, onChanged }: { p: any; api: any; onChanged: () => void }) {
  const [m, setM] = useState(String(p.price_monthly));
  const [y, setY] = useState(String(p.price_yearly));
  const dirty = m !== String(p.price_monthly) || y !== String(p.price_yearly);
  return (
    <tr className="border-b border-line/60">
      <td className="py-2.5">
        <div className="font-medium text-ink">{p.name}</div>
        <div className="text-xs text-muted">
          {p.code} · {p.currency}
        </div>
      </td>
      <td className="text-right">
        <Input type="number" className="w-24 text-right" value={m} onChange={(e) => setM(e.target.value)} />
      </td>
      <td className="text-right">
        <Input type="number" className="w-24 text-right" value={y} onChange={(e) => setY(e.target.value)} />
      </td>
      <td className="text-right text-muted">{p.tenants}</td>
      <td className="py-2.5 text-right">
        <div className="flex items-center justify-end gap-2">
          {dirty && (
            <button
              onClick={async () => {
                await api.superUpdatePlan(p.id, { price_monthly: Number(m), price_yearly: Number(y) });
                onChanged();
              }}
              className="text-xs font-semibold text-brand-600"
            >
              Kaydet
            </button>
          )}
          <button
            onClick={async () => {
              await api.superUpdatePlan(p.id, { is_active: !p.is_active });
              onChanged();
            }}
            className={`rounded-md px-2 py-0.5 text-xs font-medium ${
              p.is_active ? 'bg-emerald-100 text-emerald-800' : 'bg-canvas text-muted'
            }`}
          >
            {p.is_active ? 'Aktif' : 'Pasif'}
          </button>
        </div>
      </td>
    </tr>
  );
}

function UsersPanel({ api }: { api: any }) {
  const [q, setQ] = useState('');
  const [results, setResults] = useState<any[]>([]);

  useEffect(() => {
    if (q.trim().length < 2) {
      setResults([]);
      return;
    }
    let active = true;
    const id = setTimeout(async () => {
      try {
        const r = await api.superUsers(q.trim());
        if (active) setResults(r);
      } catch {
        if (active) setResults([]);
      }
    }, 250);
    return () => {
      active = false;
      clearTimeout(id);
    };
  }, [q, api]);

  return (
    <Card>
      <Input placeholder="E-posta veya isimle kullanıcı ara…" value={q} onChange={(e) => setQ(e.target.value)} />
      <ul className="mt-3 divide-y divide-line text-sm">
        {results.map((u) => (
          <li key={u.id} className="flex items-center justify-between py-2">
            <div>
              <span className="font-medium text-ink">{u.name}</span>{' '}
              <span className="text-muted">· {u.email}</span>
              <div className="text-xs text-muted">
                {u.tenant ?? '— (superadmin)'} · {u.role}
              </div>
            </div>
            <span className="text-xs text-muted">
              {u.last_login_at ? new Date(u.last_login_at).toLocaleDateString() : ''}
            </span>
          </li>
        ))}
        {q.trim().length >= 2 && results.length === 0 && <li className="py-3 text-muted">Sonuç yok.</li>}
      </ul>
    </Card>
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
