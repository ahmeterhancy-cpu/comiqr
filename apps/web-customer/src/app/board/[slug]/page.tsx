import { notFound } from 'next/navigation';
import { MenuBoard } from '@/components/menu-board';
import { fetchMenu } from '@/lib/menu';

/**
 * Digital menu board by venue slug (M17) — full-screen signage for a TV/tablet.
 * Read-only, auto-rotating; reuses the public menu payload.
 */
export default async function MenuBoardPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const menu = await fetchMenu(slug);

  if (!menu) {
    notFound();
  }

  return <MenuBoard menu={menu} />;
}
