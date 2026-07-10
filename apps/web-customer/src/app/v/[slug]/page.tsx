import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { MenuView } from '@/components/menu';
import { MenuChat } from '@/components/menu-chat';
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
      {/* Cart / order shortcut — only when the "add to cart" ordering module is enabled. */}
      {menu.venue?.can_order && (
        <a
          href={`/order/${slug}`}
          aria-label="Sipariş / Sepet"
          className="fixed bottom-6 right-4 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-brand-500 shadow-lg transition hover:bg-brand-600 active:scale-95"
          style={{ color: '#ffffff' }}
        >
          <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="9" cy="20" r="1.4" />
            <circle cx="19" cy="20" r="1.4" />
            <path d="M2 3h3l2.2 12.3a1.5 1.5 0 0 0 1.5 1.2h8.6a1.5 1.5 0 0 0 1.5-1.2L22 7H6.2" />
          </svg>
        </a>
      )}
    </>
  );
}
