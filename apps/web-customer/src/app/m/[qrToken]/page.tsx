import { getTranslations } from 'next-intl/server';

/**
 * Public menu route reached by scanning a table QR (docs/06 §6.2:
 * GET /menu/{qrToken}). Faz 0 renders a placeholder; Faz 1 fetches and renders
 * the live menu (categories, products, nutrition summary) here.
 */
export default async function MenuPage({ params }: { params: Promise<{ qrToken: string }> }) {
  const { qrToken } = await params;
  const t = await getTranslations('menu');

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center px-6 text-center">
      <h1 className="text-xl font-bold text-ink">{t('comingSoon')}</h1>
      <p className="mt-3 break-all rounded-lg bg-white px-4 py-3 font-mono text-xs text-muted shadow-sm">
        qrToken: {qrToken}
      </p>
    </main>
  );
}
