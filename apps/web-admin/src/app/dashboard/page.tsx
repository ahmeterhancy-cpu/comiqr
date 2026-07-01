'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import type { MeResult } from '@comiqr/shared-types';
import { Brand, Button, Card } from '@/components/ui';
import { APP_NAME, createApi } from '@/lib/api';
import { clearSession, getToken } from '@/lib/auth';

export default function DashboardPage() {
  const t = useTranslations('dashboard');
  const nav = useTranslations('nav');
  const router = useRouter();
  const [me, setMe] = useState<MeResult | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    const token = getToken();
    if (!token) {
      router.replace('/login');
      return;
    }
    createApi(token)
      .me()
      .then(setMe)
      .catch(() => {
        clearSession();
        router.replace('/login');
      });
  }, [router]);

  function logout() {
    const token = getToken();
    createApi(token).logout().catch(() => undefined);
    clearSession();
    router.replace('/login');
  }

  if (!me) {
    return <div className="grid min-h-screen place-items-center text-sm text-muted">…</div>;
  }

  const tenant = me.tenant;
  const items = [
    { key: 'dashboard', active: true },
    { key: 'menu', active: false },
    { key: 'recipes', active: false },
    { key: 'tables', active: false },
    { key: 'orders', active: false },
    { key: 'settings', active: false },
  ];

  return (
    <div className="grid min-h-screen grid-cols-[15rem_1fr] max-lg:grid-cols-1">
      {/* Sidebar */}
      <aside className="hidden flex-col border-r border-line bg-surface p-5 lg:flex">
        <Brand name={APP_NAME} />
        <nav className="mt-8 space-y-1">
          {items.map((it) => (
            <span
              key={it.key}
              className={`flex items-center justify-between rounded-lg px-3 py-2 text-sm ${
                it.active ? 'bg-brand-50 font-semibold text-brand-700' : 'text-muted'
              }`}
            >
              {nav(it.key as never)}
              {!it.active && (
                <span className="rounded bg-canvas px-1.5 py-0.5 text-[10px] text-muted">
                  {t('comingSoon')}
                </span>
              )}
            </span>
          ))}
        </nav>
        <div className="mt-auto">
          <Button variant="ghost" className="w-full" onClick={logout}>
            {nav('logout')}
          </Button>
        </div>
      </aside>

      {/* Content */}
      <main className="bg-canvas p-6 lg:p-10">
        <header className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-ink">{t('welcome', { name: me.user.name })}</h1>
            {tenant && <p className="text-sm text-muted">{tenant.name}</p>}
          </div>
          <Button variant="ghost" className="lg:hidden" onClick={logout}>
            {nav('logout')}
          </Button>
        </header>

        {tenant && (
          <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Stat label={t('subdomainLabel')} value={`${tenant.slug}`} />
            <Stat label={t('planLabel')} value={tenant.plan?.name ?? '—'} />
            <Stat label={t('statusLabel')} value={tenant.status} />
            <Stat
              label={t('trialEnds')}
              value={tenant.trial_ends_at ? new Date(tenant.trial_ends_at).toLocaleDateString() : '—'}
            />
          </div>
        )}

        <Card>
          <h2 className="text-lg font-semibold text-ink">{t('emptyTitle')}</h2>
          <p className="mt-1 max-w-xl text-sm text-muted">{t('emptyBody')}</p>

          <div className="mt-6">
            <h3 className="text-sm font-semibold text-ink">{t('nextSteps')}</h3>
            <ol className="mt-3 space-y-2">
              {[t('stepMenu'), t('stepRecipe'), t('stepQr')].map((step, i) => (
                <li key={i} className="flex items-center gap-3 text-sm text-ink">
                  <span className="grid h-6 w-6 place-items-center rounded-full bg-brand-100 text-xs font-bold text-brand-700">
                    {i + 1}
                  </span>
                  {step}
                </li>
              ))}
            </ol>
          </div>
        </Card>
      </main>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-line bg-surface p-4">
      <div className="text-xs font-medium uppercase tracking-wide text-muted">{label}</div>
      <div className="mt-1 truncate text-lg font-semibold text-ink">{value}</div>
    </div>
  );
}
