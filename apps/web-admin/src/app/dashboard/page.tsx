'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { AdminShell } from '@/components/AdminShell';
import { AiAdvisorCard } from '@/components/AiAdvisorCard';
import { Card } from '@/components/ui';
import { getActiveBranchId } from '@/lib/branch';
import { useApi } from '@/lib/useApi';

export default function DashboardPage() {
  const t = useTranslations('dashboard');
  const router = useRouter();
  const { api, me, ready } = useApi();
  const [stats, setStats] = useState<any | null>(null);
  const [heatmap, setHeatmap] = useState<any | null>(null);
  const [gated, setGated] = useState(false);

  useEffect(() => {
    if (!ready) return;
    // Superadmins have no tenant — send them to the platform console.
    if (me?.user.role === 'superadmin') {
      router.replace('/superadmin');
      return;
    }
    const branchId = getActiveBranchId() ?? undefined;
    api
      .analyticsOverview(branchId)
      .then(setStats)
      .catch(() => setGated(true));
    api
      .analyticsHeatmap(branchId)
      .then(setHeatmap)
      .catch(() => setHeatmap(null));
  }, [ready, me, router, api]);

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

      {heatmap?.products?.length > 0 && <MenuHeatmap heatmap={heatmap} currency={currency} />}

      <AiAdvisorCard />

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

const QUADRANTS: Record<string, { label: string; hint: string; cls: string }> = {
  star: { label: 'Yıldız', hint: 'popüler + kârlı', cls: 'bg-emerald-100 text-emerald-800' },
  plowhorse: { label: 'Beygir', hint: 'popüler, düşük marj', cls: 'bg-amber-100 text-amber-800' },
  puzzle: { label: 'Bilmece', hint: 'az satan, yüksek marj', cls: 'bg-sky-100 text-sky-800' },
  dog: { label: 'Köpek', hint: 'az satan, düşük marj', cls: 'bg-rose-100 text-rose-700' },
};

function MenuHeatmap({ heatmap, currency }: { heatmap: any; currency: string }) {
  const counts = heatmap.quadrant_counts ?? {};
  return (
    <Card className="mb-6">
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <h2 className="text-sm font-semibold text-ink">Menü mühendisliği (ısı haritası)</h2>
        <span className="text-xs text-muted">popülerlik × birim marj</span>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {Object.entries(QUADRANTS).map(([key, q]) => (
          <div key={key} className={`rounded-xl px-3 py-2 ${q.cls}`}>
            <div className="text-lg font-bold">{counts[key] ?? 0}</div>
            <div className="text-xs font-semibold">{q.label}</div>
            <div className="text-[10px] opacity-80">{q.hint}</div>
          </div>
        ))}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[520px] text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
              <th className="py-2 pr-3 font-medium">Ürün</th>
              <th className="py-2 pr-3 text-right font-medium">Görüntü</th>
              <th className="py-2 pr-3 text-right font-medium">Satış</th>
              <th className="py-2 pr-3 text-right font-medium">Dönüşüm</th>
              <th className="py-2 pr-3 text-right font-medium">Birim marj</th>
              <th className="py-2 font-medium">Kadran</th>
            </tr>
          </thead>
          <tbody>
            {heatmap.products.map((p: any) => {
              const q = QUADRANTS[p.quadrant] ?? QUADRANTS.dog;
              return (
                <tr key={p.id} className="border-b border-line/60">
                  <td className="py-2 pr-3">
                    <span className="font-medium text-ink">{p.name}</span>
                    {p.category && <span className="ml-1 text-xs text-muted">· {p.category}</span>}
                  </td>
                  <td className="py-2 pr-3 text-right text-muted">{p.views}</td>
                  <td className="py-2 pr-3 text-right text-ink">{p.qty}</td>
                  <td className="py-2 pr-3 text-right text-muted">
                    {p.conversion != null ? `%${(p.conversion * 100).toFixed(0)}` : '—'}
                  </td>
                  <td className="py-2 pr-3 text-right text-ink">
                    {Number(p.unit_margin).toFixed(0)} {currency}
                  </td>
                  <td className="py-2">
                    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${q.cls}`}>
                      {q.label}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
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
