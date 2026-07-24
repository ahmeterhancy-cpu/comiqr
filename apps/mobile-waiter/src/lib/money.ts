const SYMBOL: Record<string, string> = { TRY: '₺', USD: '$', EUR: '€', GBP: '£' };

/**
 * Format an amount with the tenant currency (TRY default). Formats manually —
 * Hermes on Android does not reliably honour Intl/`toLocaleString` options, so we
 * build the `1.234,56` grouping ourselves for consistent output on both platforms.
 */
export function money(value: number | string | null | undefined, currency = 'TRY'): string {
  const n = Number(value ?? 0);
  const neg = n < 0;
  const [intPart, decPart] = Math.abs(n).toFixed(2).split('.');
  const grouped = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  const body = `${grouped},${decPart}`;
  const sym = SYMBOL[currency];
  const text = sym ? `${sym}${body}` : `${body} ${currency}`;
  return neg ? `-${text}` : text;
}
