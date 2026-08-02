'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { AdminShell } from '@/components/AdminShell';
import { CockpitView } from '@/components/cockpit-view';
import { Gated, Kpi, RangeBar, firstOfMonth, money, pct, today } from '@/components/finance-kit';
import { Button, Card } from '@/components/ui';
import { API_URL } from '@/lib/api';
import { getToken } from '@/lib/auth';
import { getActiveBranchId } from '@/lib/branch';
import { useApi } from '@/lib/useApi';

export default function ReportsPage() {
  const t = useTranslations('reports');
  const c = useTranslations('common');
  const { api, me, ready } = useApi();
  const currency = me?.tenant?.currency ?? 'TRY';

  const [from, setFrom] = useState(firstOfMonth());
  const [to, setTo] = useState(today());
  const [tab, setTab] = useState<'pnl' | 'cockpit'>('pnl');
  const [data, setData] = useState<any | null>(null);
  const [cockpit, setCockpit] = useState<any | null>(null);
  const [gated, setGated] = useState(false);

  const load = useCallback(async () => {
    try {
      const branchId = getActiveBranchId() ?? undefined;
      // Both cuts share one range, so they are fetched together and the tabs
      // switch instantly instead of re-querying on every click.
      const [pnl, deep] = await Promise.all([
        api.profitLoss({ from, to, branch_id: branchId }),
        api.cockpitReport({ from, to, branch_id: branchId }),
      ]);
      setData(pnl);
      setCockpit(deep);
      setGated(false);
    } catch {
      setGated(true);
    }
  }, [api, from, to]);

  useEffect(() => {
    if (ready) load();
  }, [ready, load]);

  /** The CSV route streams a file, so it is fetched directly and saved. */
  async function downloadCsv() {
    const branchId = getActiveBranchId();
    const qs = new URLSearchParams({ from, to });
    if (branchId) qs.set('branch_id', String(branchId));

    const res = await fetch(`${API_URL}/admin/reports/profit-loss.csv?${qs}`, {
      headers: { Authorization: `Bearer ${getToken() ?? ''}` },
    });
    if (!res.ok) return;

    const url = URL.createObjectURL(await res.blob());
    const a = document.createElement('a');
    a.href = url;
    a.download = `kar-zarar-${from}_${to}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <AdminShell title={t('title')}>
      {gated ? (
        <Gated message={t('gated')} />
      ) : (
        <>
          <RangeBar
            from={from}
            to={to}
            onFrom={setFrom}
            onTo={setTo}
            labels={{ from: c('from'), to: c('to') }}
            right={
              <Button variant="ghost" onClick={downloadCsv}>
                {t('downloadCsv')}
              </Button>
            }
          />

          <div className="mb-5 flex gap-1 rounded-xl border border-line bg-surface p-1 shadow-sm sm:inline-flex">
            {(['pnl', 'cockpit'] as const).map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => setTab(key)}
                className={`flex-1 rounded-lg px-4 py-2 text-sm font-semibold transition sm:flex-none ${
                  tab === key ? 'bg-brand-500 text-white shadow-sm' : 'text-muted hover:text-ink'
                }`}
                style={tab === key ? { color: '#ffffff' } : undefined}
              >
                {t(`tab_${key}` as never)}
              </button>
            ))}
          </div>

          {tab === 'cockpit' && <CockpitView data={cockpit} currency={currency} />}

          {tab === 'pnl' && (!data ? (
            <p className="text-sm text-muted">{c('loading')}</p>
          ) : (
            <>
              <div className="mb-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
                <Kpi label={t('netSales')} value={money(data.sales.net_sales, currency)} sub={t('ordersCount', { count: data.sales.orders })} />
                <Kpi label={t('cogs')} value={money(data.cogs.cogs, currency)} sub={t('coverage', { pct: pct(data.cogs.coverage_pct) })} />
                <Kpi label={t('grossProfit')} value={money(data.gross_profit, currency)} sub={pct(data.gross_margin_pct)} tone="brand" />
                <Kpi label={t('expenses')} value={money(data.expenses.total, currency)} sub={t('expenseCount', { count: data.expenses.count })} />
                <Kpi
                  label={t('netProfit')}
                  value={money(data.net_profit, currency)}
                  sub={pct(data.net_margin_pct)}
                  tone={Number(data.net_profit) >= 0 ? 'good' : 'bad'}
                />
              </div>

              {data.cogs.coverage_pct !== null && Number(data.cogs.coverage_pct) < 100 && (
                <div className="mb-5 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                  {t('uncostedWarning', {
                    amount: money(data.cogs.uncosted_sales, currency),
                    pct: pct(data.cogs.coverage_pct),
                  })}
                </div>
              )}

              <Card className="mb-5">
                <h2 className="mb-4 text-sm font-semibold text-ink">{t('dailyChart')}</h2>
                <DailyChart days={data.daily} currency={currency} labels={{ sales: t('netSales'), cost: t('costAndExpense'), profit: t('netProfit') }} />
              </Card>

              <div className="mb-5 grid gap-5 lg:grid-cols-2">
                <Card>
                  <h2 className="mb-3 text-sm font-semibold text-ink">{t('expenseBreakdown')}</h2>
                  {data.expenses.by_category.length === 0 ? (
                    <p className="text-sm text-muted">{t('noExpenses')}</p>
                  ) : (
                    <ul className="space-y-3">
                      {data.expenses.by_category.map((row: any, i: number) => {
                        const share = data.expenses.total > 0 ? (Number(row.total) / Number(data.expenses.total)) * 100 : 0;

                        return (
                          <li key={row.id ?? `none-${i}`}>
                            <div className="flex items-baseline justify-between text-sm">
                              <span className="text-ink">
                                {row.name}
                                {row.is_fixed && <span className="ml-2 text-xs text-muted">· {t('fixed')}</span>}
                              </span>
                              <span className="tabular-nums text-muted">{money(row.total, currency)}</span>
                            </div>
                            <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-canvas">
                              <div
                                className="h-full rounded-full"
                                style={{ width: `${Math.max(2, share)}%`, background: row.color ?? '#0ea5e9' }}
                              />
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </Card>

                <Card>
                  <h2 className="mb-3 text-sm font-semibold text-ink">{t('cashView')}</h2>
                  <p className="mb-3 text-xs text-muted">{t('cashHint')}</p>
                  <ul className="divide-y divide-line">
                    {Object.entries(data.cash.by_tender ?? {}).map(([tender, amount]) => (
                      <li key={tender} className="flex items-center justify-between py-2 text-sm">
                        <span className="text-ink">{tenderLabel(tender, t)}</span>
                        <span className="tabular-nums text-muted">{money(amount as number, currency)}</span>
                      </li>
                    ))}
                    <li className="flex items-center justify-between py-2 text-sm font-semibold">
                      <span className="text-ink">{t('collectedTotal')}</span>
                      <span className="tabular-nums text-ink">{money(data.cash.collected, currency)}</span>
                    </li>
                  </ul>
                </Card>
              </div>

              <Card>
                <h2 className="mb-3 text-sm font-semibold text-ink">{t('topProducts')}</h2>
                {data.top_products.length === 0 ? (
                  <p className="text-sm text-muted">{c('empty')}</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
                          <th className="py-2">{c('name')}</th>
                          <th className="text-right">{t('qty')}</th>
                          <th className="text-right">{t('revenue')}</th>
                          <th className="text-right">{t('cost')}</th>
                          <th className="text-right">{t('contribution')}</th>
                          <th className="text-right">{t('margin')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.top_products.map((p: any) => (
                          <tr key={p.id} className="border-b border-line/60">
                            <td className="py-2 font-medium text-ink">{p.name}</td>
                            <td className="text-right tabular-nums text-muted">{p.qty}</td>
                            <td className="text-right tabular-nums text-muted">{money(p.revenue, currency)}</td>
                            <td className="text-right tabular-nums text-muted">{money(p.cost, currency)}</td>
                            <td className="text-right tabular-nums font-semibold text-ink">{money(p.profit, currency)}</td>
                            <td className="text-right tabular-nums text-muted">{pct(p.margin_pct)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </Card>
            </>
          ))}
        </>
      )}
    </AdminShell>
  );
}

function tenderLabel(tender: string, t: ReturnType<typeof useTranslations>): string {
  const known = ['cash', 'card', 'credit', 'points', 'terminal'];

  return known.includes(tender) ? t(`tender_${tender}` as never) : tender;
}

/**
 * Day-by-day bars: net sales against cost+expense, with the profit line on top.
 * Hand-drawn SVG — the panel ships no charting library.
 */
function DailyChart({
  days,
  currency,
  labels,
}: {
  days: any[];
  currency: string;
  labels: { sales: string; cost: string; profit: string };
}) {
  if (!days?.length) return null;

  const width = Math.max(days.length * 34, 320);
  const height = 180;
  const pad = 24;
  const max = Math.max(...days.map((d) => Math.max(d.net_sales, d.cogs + d.expenses, Math.abs(d.profit))), 1);
  const scale = (v: number) => (v / max) * (height - pad * 2);
  const barW = Math.min(12, (width - pad * 2) / days.length / 2.4);

  const points = days
    .map((d, i) => {
      const x = pad + (i + 0.5) * ((width - pad * 2) / days.length);
      const y = height - pad - scale(d.profit);

      return `${x},${y}`;
    })
    .join(' ');

  return (
    <div className="overflow-x-auto">
      <svg width={width} height={height} className="min-w-full">
        <line x1={pad} y1={height - pad} x2={width - pad} y2={height - pad} stroke="currentColor" className="text-line" />
        {days.map((d, i) => {
          const slot = (width - pad * 2) / days.length;
          const cx = pad + (i + 0.5) * slot;

          return (
            <g key={d.date}>
              <rect x={cx - barW - 1} y={height - pad - scale(d.net_sales)} width={barW} height={scale(d.net_sales)} rx={2} fill="#0ea5e9" opacity={0.85}>
                <title>{`${d.date} · ${labels.sales}: ${money(d.net_sales, currency)}`}</title>
              </rect>
              <rect x={cx + 1} y={height - pad - scale(d.cogs + d.expenses)} width={barW} height={scale(d.cogs + d.expenses)} rx={2} fill="#f97316" opacity={0.8}>
                <title>{`${d.date} · ${labels.cost}: ${money(d.cogs + d.expenses, currency)}`}</title>
              </rect>
            </g>
          );
        })}
        <polyline points={points} fill="none" stroke="#10b981" strokeWidth={2} strokeLinejoin="round" />
      </svg>

      <div className="mt-3 flex flex-wrap gap-4 text-xs text-muted">
        <Legend colour="#0ea5e9" label={labels.sales} />
        <Legend colour="#f97316" label={labels.cost} />
        <Legend colour="#10b981" label={labels.profit} />
      </div>
    </div>
  );
}

function Legend({ colour, label }: { colour: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="h-2.5 w-2.5 rounded-sm" style={{ background: colour }} />
      {label}
    </span>
  );
}
