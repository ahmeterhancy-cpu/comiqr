import type { Menu } from '@comiqr/shared-types';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://127.0.0.1:8000/v1';

/** Server-side public menu fetch by venue slug (docs/06 §6.2). */
export async function fetchMenu(slug: string): Promise<Menu | null> {
  try {
    const res = await fetch(`${API_URL}/menu?tenant=${encodeURIComponent(slug)}`, {
      headers: { Accept: 'application/json' },
      // Public menu changes rarely within a session; revalidate periodically.
      next: { revalidate: 30 },
    });
    if (!res.ok) return null;
    const body = (await res.json()) as { data: Menu };
    return body.data;
  } catch {
    return null;
  }
}
