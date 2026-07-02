'use client';

import type { ReactNode } from 'react';

/** Colored KPI card (dashboard hero row). */
export function StatCard({
  label,
  value,
  sub,
  icon,
  tone = 'light',
}: {
  label: string;
  value: string;
  sub?: string;
  icon: ReactNode;
  tone?: 'light' | 'indigo' | 'blue';
}) {
  const shell =
    tone === 'indigo'
      ? 'bg-brand-500 text-white'
      : tone === 'blue'
        ? 'bg-sky-500 text-white'
        : 'bg-surface text-ink border border-line';
  const iconBox = tone === 'light' ? 'bg-brand-500 text-white' : 'bg-white/20 text-white';
  const labelCls = tone === 'light' ? 'text-muted' : 'text-white/80';

  return (
    <div className={`flex items-center gap-4 rounded-2xl p-5 shadow-[var(--shadow-card)] ${shell}`}>
      <div className={`grid h-12 w-12 shrink-0 place-items-center rounded-xl ${iconBox}`}>{icon}</div>
      <div className="min-w-0">
        <div className={`text-xs font-medium uppercase tracking-wide ${labelCls}`}>{label}</div>
        <div className="mt-0.5 truncate text-2xl font-semibold">{value}</div>
        {sub && <div className={`text-xs ${labelCls}`}>{sub}</div>}
      </div>
    </div>
  );
}

/** Titled panel used across the console. */
export function Panel({ title, right, children }: { title: string; right?: ReactNode; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-line bg-surface p-5 shadow-[var(--shadow-card)]">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold text-ink">{title}</h2>
        {right}
      </div>
      {children}
    </section>
  );
}

/** Dependency-free SVG line chart for a daily series. */
export function LineChart({ series, color = '#4f46e5' }: { series: { date: string; count: number }[]; color?: string }) {
  const w = 560;
  const h = 200;
  const pad = 26;
  const bottom = h - pad - 14;
  const max = Math.max(1, ...series.map((s) => s.count));
  const stepX = (w - pad * 2) / Math.max(1, series.length - 1);

  const pts = series.map((s, i) => {
    const x = pad + i * stepX;
    const y = pad + (1 - s.count / max) * (bottom - pad);
    return [x, y] as const;
  });

  const line = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');
  const area = pts.length
    ? `${line} L${pts[pts.length - 1][0].toFixed(1)},${bottom} L${pts[0][0].toFixed(1)},${bottom} Z`
    : '';

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-auto w-full" role="img" aria-label="Zaman serisi grafiği">
      <line x1={pad} y1={bottom} x2={w - pad} y2={bottom} stroke="#e2e8f0" />
      <line x1={pad} y1={pad} x2={pad} y2={bottom} stroke="#e2e8f0" />
      {area && <path d={area} fill={color} opacity="0.08" />}
      {line && <path d={line} fill="none" stroke={color} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />}
      {pts.map((p, i) => (
        <g key={i}>
          <circle cx={p[0]} cy={p[1]} r="3.5" fill="#ffffff" stroke={color} strokeWidth="2" />
          <text x={p[0]} y={h - 4} textAnchor="middle" fontSize="9" fill="#94a3b8">
            {series[i].date.slice(5)}
          </text>
        </g>
      ))}
      <text x={pad - 6} y={pad + 4} textAnchor="end" fontSize="9" fill="#94a3b8">
        {max}
      </text>
      <text x={pad - 6} y={bottom} textAnchor="end" fontSize="9" fill="#94a3b8">
        0
      </text>
    </svg>
  );
}
