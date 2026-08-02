'use client';

/**
 * Shared bits for the finance screens (gider · cari · kâr raporu). Kept in one
 * place so the three pages read as one module rather than three lookalikes.
 */

export function money(value: number | string | null | undefined, currency = 'TRY'): string {
  const n = Number(value ?? 0);
  const symbol = currency === 'TRY' ? '₺' : currency;

  return `${n.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${symbol}`;
}

/** Turkish percent form: the sign leads, the symbol precedes the number (−%18,4). */
export function pct(value: number | null | undefined): string {
  if (value === null || value === undefined) return '—';

  const n = Number(value);
  const body = Math.abs(n).toLocaleString('tr-TR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

  return `${n < 0 ? '−' : ''}%${body}`;
}

/**
 * Local YYYY-MM-DD. Deliberately not `toISOString()` — that converts to UTC and
 * in a +03 venue would report "yesterday" after midnight and start the month a
 * day early.
 */
function isoDate(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');

  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function today(): string {
  return isoDate(new Date());
}

export function firstOfMonth(): string {
  const d = new Date();

  return isoDate(new Date(d.getFullYear(), d.getMonth(), 1));
}

/** A headline number. `tone` colours the value for profit/loss reading. */
export function Kpi({
  label,
  value,
  sub,
  tone = 'neutral',
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: 'neutral' | 'good' | 'bad' | 'brand';
}) {
  const colour =
    tone === 'good' ? 'text-emerald-600' : tone === 'bad' ? 'text-red-600' : tone === 'brand' ? 'text-brand-600' : 'text-ink';

  return (
    <div className="rounded-2xl border border-line bg-surface p-5 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted">{label}</p>
      <p className={`mt-2 text-2xl font-bold tabular-nums ${colour}`}>{value}</p>
      {sub && <p className="mt-1 text-xs text-muted">{sub}</p>}
    </div>
  );
}

export function Select({
  value,
  onChange,
  children,
  className = '',
}: {
  value: string;
  onChange: (v: string) => void;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <select
      className={`w-full rounded-lg border border-line bg-white px-3 py-2.5 text-sm text-ink outline-none focus:border-brand-500 ${className}`}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >
      {children}
    </select>
  );
}

/** Date range + optional branch picker, shared by all three finance screens. */
export function RangeBar({
  from,
  to,
  onFrom,
  onTo,
  labels,
  right,
}: {
  from: string;
  to: string;
  onFrom: (v: string) => void;
  onTo: (v: string) => void;
  labels: { from: string; to: string };
  right?: React.ReactNode;
}) {
  return (
    <div className="mb-5 flex flex-wrap items-end gap-3 rounded-2xl border border-line bg-surface p-4 shadow-sm">
      <label className="block">
        <span className="mb-1 block text-xs font-semibold text-muted">{labels.from}</span>
        <input
          type="date"
          value={from}
          onChange={(e) => onFrom(e.target.value)}
          className="rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink outline-none focus:border-brand-500"
        />
      </label>
      <label className="block">
        <span className="mb-1 block text-xs font-semibold text-muted">{labels.to}</span>
        <input
          type="date"
          value={to}
          onChange={(e) => onTo(e.target.value)}
          className="rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink outline-none focus:border-brand-500"
        />
      </label>
      {right && <div className="ml-auto flex items-end gap-2">{right}</div>}
    </div>
  );
}

/** Plan gate / load failure notice — the finance module is plan-gated (402). */
export function Gated({ message }: { message: string }) {
  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6">
      <p className="text-sm font-medium text-amber-900">{message}</p>
    </div>
  );
}

/** Signed balance: positive = they owe us, negative = we owe them. */
export function BalanceTag({ value, currency, labels }: { value: number; currency: string; labels: { receivable: string; payable: string; clear: string } }) {
  if (Math.abs(value) < 0.01) {
    return <span className="text-sm text-muted">{labels.clear}</span>;
  }

  const owed = value > 0;

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${owed ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
      {money(Math.abs(value), currency)}
      <span className="font-medium opacity-70">{owed ? labels.receivable : labels.payable}</span>
    </span>
  );
}
