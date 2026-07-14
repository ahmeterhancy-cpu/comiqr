'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import type { Reputation, Review } from '@comiqr/shared-types';
import { AdminShell } from '@/components/AdminShell';
import { Button, Card, Input } from '@/components/ui';
import { useApi } from '@/lib/useApi';

/** Owner reviews surface (Faz 3): reputation summary + list with reply/moderate. */
export default function ReviewsPage() {
  const t = useTranslations('reviews');
  const c = useTranslations('common');
  const { api, ready } = useApi();
  const [reviews, setReviews] = useState<Review[]>([]);
  const [rep, setRep] = useState<Reputation | null>(null);
  const [loading, setLoading] = useState(true);
  const [replyFor, setReplyFor] = useState<number | null>(null);
  const [replyText, setReplyText] = useState('');

  const load = useCallback(async () => {
    try {
      const res = await api.adminReviews();
      setReviews(res.reviews);
      setRep(res.reputation);
    } catch {
      /* transient */
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => {
    if (ready) load();
  }, [ready, load]);

  async function saveReply(id: number) {
    await api.replyReview(id, replyText);
    setReplyFor(null);
    setReplyText('');
    load();
  }
  async function toggleHide(r: Review) {
    await api.setReviewStatus(r.id, r.status === 'hidden' ? 'published' : 'hidden');
    load();
  }

  return (
    <AdminShell title={t('title')}>
      {rep && rep.count > 0 && (
        <Card className="mb-6">
          <div className="flex flex-wrap items-center gap-8">
            <div className="text-center">
              <div className="text-4xl font-bold text-ink">{rep.average}</div>
              <div className="text-amber-400">{'★'.repeat(Math.round(rep.average))}</div>
              <div className="mt-1 text-xs text-muted">{t('reviewCount', { count: rep.count })}</div>
            </div>
            <div className="min-w-[12rem] flex-1 space-y-1">
              {[5, 4, 3, 2, 1].map((star) => {
                const c = rep.distribution[star] ?? 0;
                const pct = rep.count ? Math.round((c / rep.count) * 100) : 0;
                return (
                  <div key={star} className="flex items-center gap-2 text-xs">
                    <span className="w-5 text-muted">{star}★</span>
                    <div className="h-2 flex-1 rounded-full bg-canvas">
                      <div className="h-2 rounded-full bg-amber-400" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="w-6 text-right text-muted">{c}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </Card>
      )}

      {loading ? (
        <Card>{c('loading')}</Card>
      ) : reviews.length === 0 ? (
        <Card>
          <p className="py-8 text-center text-sm text-muted">{t('empty')}</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {reviews.map((r) => (
            <Card key={r.id} className={r.status === 'hidden' ? 'opacity-60' : ''}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm font-semibold">
                    <span className="text-amber-400">{'★'.repeat(r.rating)}</span>
                    <span className="text-line">{'★'.repeat(5 - r.rating)}</span>
                  </div>
                  {r.comment && <p className="mt-1 text-sm text-ink">{r.comment}</p>}
                  {r.reply && (
                    <p className="mt-2 rounded-lg bg-canvas px-3 py-2 text-xs text-muted">
                      <b className="text-ink">{t('yourReply')}</b> {r.reply}
                    </p>
                  )}
                  <p className="mt-1 text-[11px] text-muted">
                    #{r.order_id} · {new Date(r.created_at).toLocaleDateString('tr-TR')}
                    {r.status === 'hidden' ? ` · ${t('hiddenTag')}` : ''}
                  </p>
                </div>
                <div className="flex shrink-0 gap-1.5">
                  <button
                    onClick={() => {
                      setReplyFor(replyFor === r.id ? null : r.id);
                      setReplyText(r.reply ?? '');
                    }}
                    className="rounded-md border border-line px-2 py-1 text-xs font-medium text-muted hover:bg-canvas"
                  >
                    {t('reply')}
                  </button>
                  <button
                    onClick={() => toggleHide(r)}
                    className="rounded-md border border-line px-2 py-1 text-xs font-medium text-muted hover:bg-canvas"
                  >
                    {r.status === 'hidden' ? t('show') : t('hide')}
                  </button>
                </div>
              </div>
              {replyFor === r.id && (
                <div className="mt-3 flex gap-2">
                  <Input value={replyText} onChange={(e) => setReplyText(e.target.value)} placeholder={t('replyPlaceholder')} className="flex-1" />
                  <Button onClick={() => saveReply(r.id)}>{c('save')}</Button>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
    </AdminShell>
  );
}
