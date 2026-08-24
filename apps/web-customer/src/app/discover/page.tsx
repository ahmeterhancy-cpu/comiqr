'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { ApiClient } from '@comiqr/shared-types/client';
import type { DiscoverVenue } from '@comiqr/shared-types';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://127.0.0.1:8000/v1';

/**
 * Consumer discovery portal (M20) — browse active venues and open their public
 * menu (/{slug}). Debounced name search against the public /discover endpoint.
 */
export default function DiscoverPage() {
  const t = useTranslations('discover');
  const api = useMemo(() => new ApiClient({ baseUrl: API_URL }), []);
  const [q, setQ] = useState('');
  const [venues, setVenues] = useState<DiscoverVenue[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    const id = setTimeout(() => {
      api
        .discover(q.trim() || undefined)
        .then((v) => active && setVenues(v))
        .catch(() => active && setVenues([]))
        .finally(() => active && setLoading(false));
    }, 250);
    return () => {
      active = false;
      clearTimeout(id);
    };
  }, [q, api]);

  return (
    <div className="mx-auto max-w-3xl px-5 pb-16">
      <header className="relative overflow-hidden bg-[color:var(--color-navy)] px-6 pb-8 pt-10 text-white" style={{ marginInline: '-1.25rem' }}>
        <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/10" />
        <p className="relative text-xs font-medium uppercase tracking-[0.25em] text-white/70">{t('kicker')}</p>
        <h1 className="relative mt-1 font-display text-3xl font-semibold">{t('title')}</h1>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t('searchPlaceholder')}
          className="relative mt-5 w-full rounded-xl border-0 bg-white/95 px-4 py-3 text-sm text-ink outline-none placeholder:text-muted"
        />
      </header>

      <div className="mt-6">
        {loading && <p className="text-sm text-muted">{t('loading')}</p>}
        {!loading && venues.length === 0 && <p className="text-sm text-muted">{t('noResults')}</p>}

        <div className="grid gap-3.5 sm:grid-cols-2">
          {venues.map((v) => (
            <div
              key={v.slug}
              className="overflow-hidden rounded-2xl border border-line bg-surface shadow-[var(--shadow-card)]"
            >
              <div className="p-4">
                <div className="flex items-baseline justify-between gap-2">
                  <h2 className="font-display text-lg font-semibold text-ink">{v.name}</h2>
                  <span className="shrink-0 text-xs text-muted">
                    {(v.reviews_count ?? 0) > 0 && (
                      <span className="mr-2 font-semibold text-amber-500">★ {v.rating}</span>
                    )}
                    {t('productCount', { count: v.product_count })}
                  </span>
                </div>
                {v.samples.length > 0 && (
                  <p className="mt-1.5 line-clamp-2 text-sm text-muted">
                    {v.samples.map((s) => s.name).join(' · ')}
                  </p>
                )}
                <div className="mt-3 flex items-center gap-3">
                  <Link href={`/${v.slug}`} className="text-xs font-semibold text-brand-600 hover:underline">
                    {t('viewMenu')} →
                  </Link>
                  <Link
                    href={`/order/${v.slug}`}
                    className="rounded-full bg-brand-500 px-3 py-1 text-xs font-semibold text-white"
                  >
                    {t('takeaway')}
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
