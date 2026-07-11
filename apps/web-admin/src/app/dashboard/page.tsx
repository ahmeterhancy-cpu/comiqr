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
          <KpiCard label="Tarama (30g)" value={String(stats.scans)} spark="a" icon="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7zM12 12a2.5 2.5 0 100-.01" />
          <KpiCard label="Sipariş" value={String(stats.orders)} spark="b" icon="M2 3h3l2.2 12.3a1.5 1.5 0 001.5 1.2h8.6a1.5 1.5 0 001.5-1.2L22 7H6.2M9 20a1 1 0 100 .01M19 20a1 1 0 100 .01" />
          <KpiCard label="Ciro" value={`${stats.revenue} ${currency}`} spark="c" icon="M12 3v18M8 7h6a3 3 0 010 6H9a3 3 0 000 6h7" />
          <KpiCard label="Ort. Sipariş" value={`${stats.avg_order_value} ${currency}`} spark="d" icon="M3 3v18h18M7 14l3-4 4 3 4-6" />
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
  plowhorse: { label: 'Gözde', hint: 'popüler, düşük marj', cls: 'bg-amber-100 text-amber-800' },
  puzzle: { label: 'Fırsat', hint: 'az satan, yüksek marj', cls: 'bg-sky-100 text-sky-800' },
  dog: { label: 'Zayıf', hint: 'az satan, düşük marj', cls: 'bg-rose-100 text-rose-700' },
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

const SPARKS: Record<string, string> = {
  a: 'M0 30 C 20 26, 32 12, 52 18 S 96 34, 120 22 S 168 6, 200 14',
  b: 'M0 22 C 24 28, 40 10, 64 16 S 108 30, 132 18 S 172 8, 200 20',
  c: 'M0 34 C 22 24, 44 26, 66 16 S 112 6, 140 18 S 176 26, 200 10',
  d: 'M0 28 C 20 22, 36 30, 58 20 S 104 8, 128 18 S 170 12, 200 8',
};

function KpiCard({ label, value, icon, spark }: { label: string; value: string; icon: string; spark: string }) {
  const line = SPARKS[spark] ?? SPARKS.a;
  return (
    <div className="rounded-2xl border border-line bg-surface p-5 shadow-sm transition hover:shadow-md">
      <div className="flex items-start gap-3">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl text-white shadow-md" style={{ background: 'linear-gradient(135deg,#14b8a6,#0ea5e9)' }}>
          <svg viewBox="0 0 24 24" className="h-[22px] w-[22px]" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d={icon} /></svg>
        </span>
        <div className="min-w-0">
          <div className="text-xs font-semibold text-muted">{label}</div>
          <div className="mt-0.5 truncate text-2xl font-extrabold tracking-tight text-ink">{value}</div>
        </div>
      </div>
      <svg viewBox="0 0 200 40" className="mt-3 h-10 w-full" preserveAspectRatio="none">
        <defs>
          <linearGradient id={`sf-${spark}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#14b8a6" stopOpacity="0.22" />
            <stop offset="1" stopColor="#14b8a6" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={`${line} L200 40 L0 40 Z`} fill={`url(#sf-${spark})`} />
        <path d={line} fill="none" stroke="#14b8a6" strokeWidth="2" strokeLinecap="round" />
      </svg>
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className={`rounded-2xl border border-line p-4 ${accent ? 'bg-brand-50' : 'bg-surface'}`}>
      <div className="text-xs font-medium uppercase tracking-wide text-muted">{label}</div>
      <div className="mt-1 truncate text-lg font-semibold text-ink">{value}</div>
    </div>
  );
}
