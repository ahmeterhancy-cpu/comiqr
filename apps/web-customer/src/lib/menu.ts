import type { Menu } from '@comiqr/shared-types';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://127.0.0.1:8000/v1';

type MenuWithTable = Menu & { table?: { id: number; code: string; qr_token: string } };

// Statuses worth a single retry: the /menu route is rate-limited (60/min) and
// returns a transient 404 to the owner's IP when preview polling hammers it, plus
// the usual 429/5xx blips. A real "venue not found" also 404s, so the retry costs
// one extra request in that case — acceptable for a public-facing page.
const RETRYABLE = new Set([404, 408, 425, 429, 500, 502, 503, 504]);

async function attempt(path: string, fresh: boolean): Promise<MenuWithTable | null | 'retry'> {
  try {
    const res = await fetch(`${API_URL}${path}`, {
      headers: { Accept: 'application/json' },
      // `fresh` (builder preview) bypasses the ISR cache so saved changes show at once.
      ...(fresh ? { cache: 'no-store' as const } : { next: { revalidate: 30 } }),
    });
    if (!res.ok) return RETRYABLE.has(res.status) ? 'retry' : null;
    const body = (await res.json()) as { data: MenuWithTable };
    return body.data;
  } catch {
    // Network/abort error — transient, worth one retry.
    return 'retry';
  }
}

async function get(path: string, fresh = false): Promise<MenuWithTable | null> {
  const first = await attempt(path, fresh);
  if (first !== 'retry') return first;
  // One retry after a short backoff — lets a rate-limit window or blip clear.
  await new Promise((r) => setTimeout(r, 600));
  const second = await attempt(path, fresh);
  return second === 'retry' ? null : second;
}

/** Public menu by venue slug (docs/06 §6.2). */
export function fetchMenu(slug: string, opts: { locale?: string; fresh?: boolean } = {}): Promise<Menu | null> {
  const params = new URLSearchParams({ tenant: slug });
  if (opts.locale) params.set('locale', opts.locale);
  return get(`/menu?${params.toString()}`, !!opts.fresh);
}

/** Public menu by scanned QR token — includes table context (M3, docs/06 §6.2). */
export function fetchMenuByToken(qrToken: string): Promise<MenuWithTable | null> {
  return get(`/menu/${encodeURIComponent(qrToken)}`);
}
