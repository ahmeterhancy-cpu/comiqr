import { notFound } from 'next/navigation';
import { getLocale, getTranslations } from 'next-intl/server';
import { MenuView } from '@/components/menu';
import { MenuChat } from '@/components/menu-chat';
import { CartFab } from '@/components/cart';
import { MenuUnavailable } from '@/components/menu-unavailable';
import { fetchMenuResult } from '@/lib/menu';

/**
 * Public venue menu by slug (M1/M2 payoff — live nutrition on the customer PWA).
 * The QR-token route (/m/[qrToken]) will resolve to the same view in M3.
 */
export default async function VenueMenuPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ theme?: string; locale?: string; preview?: string; r?: string }>;
}) {
  const { slug } = await params;
  const { theme, locale, preview, r } = await searchParams;
  // Diners pick a language via the cookie-based switcher (next-intl getLocale reads
  // that cookie); the menu content must follow it. ?locale only overrides in the
  // admin builder preview, which forces a specific locale.
  const activeLocale = preview && locale ? locale : await getLocale();
  const result = await fetchMenuResult(slug, { locale: activeLocale, fresh: !!preview });

  // A genuine missing venue is a real 404; a transient failure (rate-limit / blip)
  // shows a soft, auto-retrying state instead of an alarming "page not found".
  if (result.status === 'not-found') {
    notFound();
  }
  if (result.status === 'unavailable') {
    const attempt = Number.parseInt(r ?? '0', 10);
    return <MenuUnavailable attempt={Number.isFinite(attempt) ? attempt : 0} />;
  }
  const menu = result.menu;

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
    back: t('back'),
    table: t('table'),
    searchPlaceholder: t('searchPlaceholder'),
    allMenu: t('allMenu'),
    noResults: t('noResults'),
    viewOrder: t('viewOrder'),
    add: t('add'),
    decrease: t('decrease'),
    increase: t('increase'),
  };

  return (
    <>
      <MenuView menu={menu} labels={labels} />
      {menu.venue?.ai_chat && <MenuChat slug={slug} />}
      {/* Cart shortcut — only when the "add to cart" ordering module is enabled.
          Classic renders its own full-width "view order" bar, so the FAB would double up. */}
      {menu.venue?.can_order && menu.venue?.show_cart !== false && menu.venue?.theme !== 'classic' && (
        <CartFab slug={slug} currency={menu.venue.currency} locale={menu.venue.locale_default} />
      )}
    </>
  );
}
