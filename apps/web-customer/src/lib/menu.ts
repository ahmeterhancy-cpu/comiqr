import type { Menu } from '@comiqr/shared-types';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://127.0.0.1:8000/v1';

type MenuWithTable = Menu & { table?: { id: number; code: string; qr_token: string } };

async function get(path: string): Promise<MenuWithTable | null> {
  try {
    const res = await fetch(`${API_URL}${path}`, {
      headers: { Accept: 'application/json' },
      next: { revalidate: 30 },
    });
    if (!res.ok) return null;
    const body = (await res.json()) as { data: MenuWithTable };
    return body.data;
  } catch {
    return null;
  }
}

/** Public menu by venue slug (docs/06 §6.2). */
export function fetchMenu(slug: string): Promise<Menu | null> {
  return get(`/menu?tenant=${encodeURIComponent(slug)}`);
}

/** Public menu by scanned QR token — includes table context (M3, docs/06 §6.2). */
export function fetchMenuByToken(qrToken: string): Promise<MenuWithTable | null> {
  return get(`/menu/${encodeURIComponent(qrToken)}`);
}
