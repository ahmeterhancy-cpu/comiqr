import { getTranslations } from 'next-intl/server';

export default async function Board() {
  const t = await getTranslations('board');
  const columns = [
    { key: 'columnNew', color: 'var(--color-new)' },
    { key: 'columnPreparing', color: 'var(--color-prep)' },
    { key: 'columnReady', color: 'var(--color-ready)' },
  ] as const;

  return (
    <main className="flex min-h-screen flex-col p-6">
      <header className="mb-6 flex items-baseline justify-between">
        <h1 className="text-2xl font-bold">{t('title')}</h1>
        <p className="text-sm text-[var(--color-muted)]">{t('subtitle')}</p>
      </header>

      <div className="grid flex-1 grid-cols-3 gap-4">
        {columns.map((c) => (
          <section
            key={c.key}
            className="flex flex-col rounded-xl border bg-[var(--color-panel)]"
          >
            <div
              className="flex items-center gap-2 border-b px-4 py-3 text-sm font-bold uppercase tracking-wide"
              style={{ color: c.color }}
            >
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: c.color }} />
              {t(c.key)}
            </div>
            <div className="grid flex-1 place-items-center p-6 text-sm text-[var(--color-muted)]">
              {t('empty')}
            </div>
          </section>
        ))}
      </div>

      <footer className="mt-4 text-center text-xs text-[var(--color-muted)]">
        {t('comingSoon')}
      </footer>
    </main>
  );
}
