'use client';

import { useTranslations } from 'next-intl';
import { Kpi, money, pct } from '@/components/finance-kit';
import { Card } from '@/components/ui';

/**
 * Rapor Kokpiti (roadmap madde 4): the deeper cuts under the P&L headline —
 * when the venue is busy, what sells, who sold it, what was given away, and how
 * the tax splits.
 */
export function CockpitView({ data, currency }: { data: any; currency: string }) {
  const t = useTranslations('reports');
  const c = useTranslations('common');

  if (!data) return <p className="text-sm text-muted">{c('loading')}</p>;

  return (
    <>
      <Card className="mb-5">
        <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-sm font-semibold text-ink">{t('hourlyTitle')}</h2>
          {data.hourly.peak && (
            <span className="text-xs text-muted">
              {t('peakSlot', {
                day: t(`wd_${data.hourly.peak.weekday}` as never),
                hour: `${String(data.hourly.peak.hour).padStart(2, '0')}:00`,
                amount: money(data.hourly.peak.revenue, currency),
              })}
            </span>
          )}
        </div>
        <HeatMatrix hourly={data.hourly} currency={currency} weekday={(i: number) => t(`wd_${i}` as never)} />
      </Card>

      <div className="mb-5 grid gap-5 lg:grid-cols-2">
        <Card>
          <h2 className="mb-3 text-sm font-semibold text-ink">{t('categoryBreakdown')}</h2>
          {data.categories.length === 0 ? (
            <p className="text-sm text-muted">{c('empty')}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
                    <th className="py-2">{t('category')}</th>
                    <th className="text-right">{t('qty')}</th>
                    <th className="text-right">{t('revenue')}</th>
                    <th className="text-right">{t('contribution')}</th>
                    <th className="text-right">{t('share')}</th>
                  </tr>
                </thead>
                <tbody>
                  {data.categories.map((row: any, i: number) => (
                    <tr key={row.id ?? `none-${i}`} className="border-b border-line/60">
                      <td className="py-2 font-medium text-ink">{row.name}</td>
                      <td className="text-right tabular-nums text-muted">{row.qty}</td>
                      <td className="text-right tabular-nums text-muted">{money(row.revenue, currency)}</td>
                      <td className="text-right tabular-nums font-semibold text-ink">{money(row.profit, currency)}</td>
                      <td className="text-right tabular-nums text-muted">{pct(row.share_pct)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <Card>
          <h2 className="mb-1 text-sm font-semibold text-ink">{t('staffTitle')}</h2>
          <p className="mb-3 text-xs text-muted">{t('staffHint')}</p>
          {data.staff.length === 0 ? (
            <p className="text-sm text-muted">{c('empty')}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
                    <th className="py-2">{c('name')}</th>
                    <th className="text-right">{t('orders')}</th>
                    <th className="text-right">{t('revenue')}</th>
                    <th className="text-right">{t('avgOrder')}</th>
                  </tr>
                </thead>
                <tbody>
                  {data.staff.map((row: any, i: number) => (
                    <tr key={row.id ?? `self-${i}`} className="border-b border-line/60">
                      <td className="py-2 font-medium text-ink">{row.name ?? t('selfService')}</td>
                      <td className="text-right tabular-nums text-muted">{row.orders}</td>
                      <td className="text-right tabular-nums text-muted">{money(row.revenue, currency)}</td>
                      <td className="text-right tabular-nums text-ink">{money(row.avg_order, currency)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>

      <div className="mb-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label={t('giveawayTotal')} value={money(data.giveaways.total, currency)} tone="bad" sub={t('giveawayHint')} />
        <Kpi label={t('voids')} value={money(data.giveaways.void_amount, currency)} sub={t('voidLines', { count: data.giveaways.void_lines })} />
        <Kpi label={t('lineDiscounts')} value={money(data.giveaways.line_discounts, currency)} />
        <Kpi
          label={t('orderDiscounts')}
          value={money(data.giveaways.order_discounts, currency)}
          sub={t('discountedOrders', { count: data.giveaways.discounted_orders })}
        />
      </div>

      {data.giveaways.by_source.length > 0 && (
        <Card className="mb-5">
          <h2 className="mb-3 text-sm font-semibold text-ink">{t('discountSources')}</h2>
          <ul className="divide-y divide-line">
            {data.giveaways.by_source.map((row: any) => (
              <li key={row.source} className="flex items-center justify-between py-2 text-sm">
                <span className="text-ink">{row.source}</span>
                <span className="tabular-nums text-muted">{money(row.amount, currency)}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card>
        <h2 className="mb-1 text-sm font-semibold text-ink">{t('taxTitle')}</h2>
        <p className="mb-3 text-xs text-muted">{t('taxHint', { rate: pct(data.tax.default_rate) })}</p>
        {data.tax.lines.length === 0 ? (
          <p className="text-sm text-muted">{c('empty')}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
                  <th className="py-2">{t('rate')}</th>
                  <th className="text-right">{t('gross')}</th>
                  <th className="text-right">{t('taxBase')}</th>
                  <th className="text-right">{t('vat')}</th>
                </tr>
              </thead>
              <tbody>
                {data.tax.lines.map((row: any) => (
                  <tr key={row.rate} className="border-b border-line/60">
                    <td className="py-2 font-medium text-ink">{pct(row.rate)}</td>
                    <td className="text-right tabular-nums text-muted">{money(row.gross, currency)}</td>
                    <td className="text-right tabular-nums text-muted">{money(row.net, currency)}</td>
                    <td className="text-right tabular-nums font-semibold text-ink">{money(row.vat, currency)}</td>
                  </tr>
                ))}
                <tr className="font-semibold">
                  <td className="py-2 text-ink">{c('total')}</td>
                  <td className="text-right tabular-nums text-ink">{money(data.tax.gross_total, currency)}</td>
                  <td className="text-right tabular-nums text-ink">{money(data.tax.net_total, currency)}</td>
                  <td className="text-right tabular-nums text-ink">{money(data.tax.vat_total, currency)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}

/**
 * Weekday × hour grid. Cell opacity tracks revenue against the busiest slot, so
 * the rush reads at a glance without a legend.
 */
function HeatMatrix({
  hourly,
  currency,
  weekday,
}: {
  hourly: any;
  currency: string;
  weekday: (i: number) => string;
}) {
  const max = Number(hourly.max_revenue) || 0;
  const hours = Array.from({ length: 24 }, (_, h) => h);

  if (max <= 0) {
    return <p className="text-sm text-muted">—</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="border-separate border-spacing-[2px] text-xs">
        <thead>
          <tr>
            <th />
            {hours.map((h) => (
              <th key={h} className="w-6 pb-1 text-center font-medium text-muted">
                {h % 3 === 0 ? String(h).padStart(2, '0') : ''}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {[0, 1, 2, 3, 4, 5, 6].map((d) => (
            <tr key={d}>
              <td className="pr-2 text-right font-medium text-muted">{weekday(d).slice(0, 3)}</td>
              {hours.map((h) => {
                const cell = hourly.matrix?.[d]?.[h];
                const value = Number(cell?.revenue ?? 0);
                const intensity = value > 0 ? 0.15 + (value / max) * 0.85 : 0;

                return (
                  <td key={h}>
                    <div
                      className="h-6 w-6 rounded"
                      style={{ background: intensity > 0 ? `rgba(14,165,233,${intensity})` : 'var(--canvas, #f1f5f9)' }}
                      title={
                        value > 0
                          ? `${weekday(d)} ${String(h).padStart(2, '0')}:00 — ${money(value, currency)} · ${cell.orders}`
                          : undefined
                      }
                    />
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
