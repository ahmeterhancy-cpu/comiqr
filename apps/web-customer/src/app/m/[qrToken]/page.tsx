import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { OrderableMenu } from '@/components/orderable-menu';
import { fetchMenuByToken } from '@/lib/menu';

/**
 * Menu reached by scanning a table QR (M3/M4, docs/06 §6.2/§6.3). Renders the
 * live menu with nutrition, plus an interactive cart that places orders against
 * the table's session (server-priced).
 */
export default async function ScannedMenuPage({ params }: { params: Promise<{ qrToken: string }> }) {
  const { qrToken } = await params;
  const menu = await fetchMenuByToken(qrToken);

  if (!menu) {
    notFound();
  }

  const t = await getTranslations('menu');
  const o = await getTranslations('order');

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

  const strings = {
    add: o('add'),
    cart: o('cart'),
    placeOrder: o('placeOrder'),
    placing: o('placing'),
    placed: o('placed'),
    orderStatus: o('orderStatus'),
    empty: t('empty'),
    total: o('total'),
    error: o('error'),
  };

  return (
    <OrderableMenu
      menu={menu}
      labels={labels}
      qrToken={qrToken}
      tableCode={menu.table?.code}
      strings={strings}
    />
  );
}
