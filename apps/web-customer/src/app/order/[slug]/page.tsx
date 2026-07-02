import { notFound } from 'next/navigation';
import { PackageOrder } from '@/components/package-order';
import { fetchMenu } from '@/lib/menu';

/**
 * Package-service ordering by venue slug (M20) — delivery/takeaway, pay at the
 * door or online (Tiko). Reached from the marketplace (/discover) or the menu.
 */
export default async function PackageOrderPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const menu = await fetchMenu(slug);

  if (!menu) {
    notFound();
  }

  return <PackageOrder menu={menu} slug={slug} />;
}
