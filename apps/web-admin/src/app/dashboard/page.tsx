'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { AdminShell } from '@/components/AdminShell';
import { Card } from '@/components/ui';
import { useApi } from '@/lib/useApi';

export default function DashboardPage() {
  const t = useTranslations('dashboard');
  const { api, me, ready } = useApi();
  const [stats, setStats] = useState<any | null>(null);
  const [gated, setGated] = useState(false);

  useEffect(() => {
    if (!ready) return;
    api
      .analyticsOverview()
      .then(setStats)
      .catch(() => setGated(true));
  }, [ready, api]);

  if (!ready || !me) {
    return <div className="grid min-h-screen place-items-center text-sm text-muted">…</div>;
  }

  const tenant = me.tenant;
  const currency = tenant?.currency ?? 'TRY';

  return (
    <AdminShell title={t('welcome', { name: me.user.name })}>
      {tenant && (
        <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label={t('subdomainLabel')} value={tenant.slug} />
          <Stat label={t('planLabel')} value={tenant.plan?.name ?? '—'} />
          <Stat label={t('statusLabel')} value={tenant.status} />
          <Stat
            label={t('trialEnds')}
            value={tenant.trial_ends_at ? new Date(tenant.trial_ends_at).toLocaleDateString() : '—'}
          />
        </div>
      )}

      {stats && (
        <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="Tarama (30g)" value={String(stats.scans)} accent />
          <Stat label="Sipariş" value={String(stats.orders)} accent />
          <Stat label="Ciro" value={`${stats.revenue} ${currency}`} accent />
          <Stat label="Ort. Sipariş" value={`${stats.avg_order_value} ${currency}`} accent />
        </div>
      )}

      {gated && (
        <Card className="mb-6">
          <p className="text-sm text-muted">
            Analitik bu planda kapalı. Sipariş ve gelişmiş raporlar için planı yükseltin.
          </p>
        </Card>
      )}

      {stats?.top_products?.length > 0 && (
        <Card className="mb-6">
          <h2 className="mb-3 text-sm font-semibold text-ink">En çok satanlar</h2>
          <ul className="divide-y divide-line">
            {stats.top_products.map((p: any) => (
              <li key={p.id} className="flex items-center justify-between py-2 text-sm">
                <span className="text-ink">{p.name}</span>
                <span className="text-muted">
                  {p.qty} adet · {Number(p.revenue).toFixed(0)} {currency}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card>
        <h2 className="text-lg font-semibold text-ink">{t('nextSteps')}</h2>
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
      </Card>
    </AdminShell>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className={`rounded-xl border border-line p-4 ${accent ? 'bg-brand-50' : 'bg-surface'}`}>
      <div className="text-xs font-medium uppercase tracking-wide text-muted">{label}</div>
      <div className="mt-1 truncate text-lg font-semibold text-ink">{value}</div>
    </div>
  );
}
