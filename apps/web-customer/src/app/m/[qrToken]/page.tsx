import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { MenuView } from '@/components/menu';
import { fetchMenuByToken } from '@/lib/menu';

/**
 * Menu reached by scanning a table QR (M3, docs/06 §6.2: GET /menu/{qrToken}).
 * Renders the live menu with nutrition and the resolved table context.
 */
export default async function ScannedMenuPage({ params }: { params: Promise<{ qrToken: string }> }) {
  const { qrToken } = await params;
  const menu = await fetchMenuByToken(qrToken);

  if (!menu) {
    notFound();
  }

  const t = await getTranslations('menu');
  const labels = {
    kcal: t('kcal'),
    protein: t('protein'),
    carb: t('carb'),
    fat: t('fat'),
    contains: t('contains'),
    traces: t('traces'),
    vegan: t('vegan'),
    vegetarian: t('vegetarian'),
    glutenFree: t('glutenFree'),
    estimated: t('estimated'),
    empty: t('empty'),
  };

  return <MenuView menu={menu} labels={labels} tableCode={menu.table?.code} />;
}
