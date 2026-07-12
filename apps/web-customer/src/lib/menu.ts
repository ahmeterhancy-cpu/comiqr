import type { Menu } from '@comiqr/shared-types';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://127.0.0.1:8000/v1';

type MenuWithTable = Menu & { table?: { id: number; code: string; qr_token: string } };

/**
 * Discriminated fetch outcome so pages can tell a genuine "not found" (→ 404)
 * apart from a transient failure (→ "try again"). The builder preview polls the
 * public /menu endpoint with `no-store`, and that endpoint is rate-limited
 * (120/min per IP); when it trips the API returns 429, which must NOT read as a
 * missing venue.
 */
export type MenuResult =
  | { status: 'ok'; menu: MenuWithTable }
  | { status: 'not-found' }
  | { status: 'unavailable' };

// Transient statuses worth a single retry. Deliberately excludes 404: this API
// returns 429 when the public rate limit trips, while a real missing venue 404s —
// so 404 stays "not found", never a retry that could mask a genuine 404 as
// "unavailable" forever.
const RETRYABLE = new Set([408, 425, 429, 500, 502, 503, 504]);

async function attempt(path: string, fresh: boolean): Promise<MenuResult | 'retry'> {
  try {
    const res = await fetch(`${API_URL}${path}`, {
      headers: { Accept: 'application/json' },
      // `fresh` (builder preview) bypasses the ISR cache so saved changes show at once.
      ...(fresh ? { cache: 'no-store' as const } : { next: { revalidate: 30 } }),
    });
    if (res.ok) {
      const body = (await res.json()) as { data: MenuWithTable };
      return { status: 'ok', menu: body.data };
    }
    if (RETRYABLE.has(res.status)) return 'retry';
    // 404 and any other non-retryable status → treat as a missing menu.
    return { status: 'not-found' };
  } catch {
    // Network/abort error — transient, worth one retry.
    return 'retry';
  }
}

async function getResult(path: string, fresh: boolean): Promise<MenuResult> {
  const first = await attempt(path, fresh);
  if (first !== 'retry') return first;
  // One retry after a short backoff — clears a network blip or a just-crossed
  // rate-limit edge. A sustained rate limit is handled by the page's soft state.
  await new Promise((r) => setTimeout(r, 600));
  const second = await attempt(path, fresh);
  return second === 'retry' ? { status: 'unavailable' } : second;
}

/** Public menu by venue slug — discriminated result (docs/06 §6.2). */
export function fetchMenuResult(
  slug: string,
  opts: { locale?: string; fresh?: boolean } = {},
): Promise<MenuResult> {
  const params = new URLSearchParams({ tenant: slug });
  if (opts.locale) params.set('locale', opts.locale);
  return getResult(`/menu?${params.toString()}`, !!opts.fresh);
}

/** Public menu by venue slug — `Menu | null` for callers that only need presence. */
export async function fetchMenu(
  slug: string,
  opts: { locale?: string; fresh?: boolean } = {},
): Promise<Menu | null> {
  const r = await fetchMenuResult(slug, opts);
  return r.status === 'ok' ? r.menu : null;
}

/** Public menu by scanned QR token — includes table context (M3, docs/06 §6.2). */
export async function fetchMenuByToken(qrToken: string): Promise<MenuWithTable | null> {
  const r = await getResult(`/menu/${encodeURIComponent(qrToken)}`, false);
  return r.status === 'ok' ? r.menu : null;
}
