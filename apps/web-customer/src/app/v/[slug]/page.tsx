import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { MenuView } from '@/components/menu';
import { MenuChat } from '@/components/menu-chat';
import { CartFab } from '@/components/cart';
import { fetchMenu } from '@/lib/menu';

/**
 * Public venue menu by slug (M1/M2 payoff — live nutrition on the customer PWA).
 * The QR-token route (/m/[qrToken]) will resolve to the same view in M3.
 */
export default async function VenueMenuPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ theme?: string }>;
}) {
  const { slug } = await params;
  const { theme } = await searchParams;
  const menu = await fetchMenu(slug);

  if (!menu) {
    notFound();
  }

  // ?theme=classic|flipbook|modern previews a layout without changing settings.
  if (theme && ['classic', 'flipbook', 'modern'].includes(theme)) {
    menu.venue = { ...menu.venue, theme: theme as 'classic' | 'flipbook' | 'modern' };
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

  return (
    <>
      <MenuView menu={menu} labels={labels} />
      {menu.venue?.ai_chat && <MenuChat slug={slug} />}
      {/* Cart shortcut — only when the "add to cart" ordering module is enabled. */}
      {menu.venue?.can_order && (
        <CartFab slug={slug} currency={menu.venue.currency} locale={menu.venue.locale_default} />
      )}
    </>
  );
}
