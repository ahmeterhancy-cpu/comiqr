import { getTranslations } from 'next-intl/server';

export default async function Landing() {
  const t = await getTranslations('landing');
  const app = await getTranslations('app');
  const appName = process.env.NEXT_PUBLIC_APP_NAME ?? 'ComiQR';

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center px-6 text-center">
      <span className="grid h-14 w-14 place-items-center rounded-2xl bg-brand-500 text-2xl font-bold text-white">
        {appName.charAt(0)}
      </span>
      <h1 className="mt-6 text-2xl font-bold text-ink">{t('title')}</h1>
      <p className="mt-2 text-sm text-muted">{app('tagline')}</p>
      <p className="mt-6 text-sm text-ink/80">{t('body')}</p>
      <p className="mt-8 rounded-lg bg-white px-4 py-3 text-xs text-muted shadow-sm">
        {t('demoNote')}
      </p>
    </main>
  );
}
