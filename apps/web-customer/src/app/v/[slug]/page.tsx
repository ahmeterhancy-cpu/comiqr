import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { MenuView } from '@/components/menu';
import { fetchMenu } from '@/lib/menu';

/**
 * Public venue menu by slug (M1/M2 payoff — live nutrition on the customer PWA).
 * The QR-token route (/m/[qrToken]) will resolve to the same view in M3.
 */
export default async function VenueMenuPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const menu = await fetchMenu(slug);

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

  return (
    <>
      <MenuView menu={menu} labels={labels} />
      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-surface/95 px-5 py-3 backdrop-blur">
        <a
          href={`/order/${slug}`}
          className="mx-auto block max-w-2xl rounded-xl bg-brand-500 py-3 text-center text-sm font-semibold text-white"
          style={{ color: '#ffffff' }}
        >
          Paket Servis Sipariş Ver
        </a>
      </div>
    </>
  );
}
