'use client';

import { useState } from 'react';
import { Card } from '@/components/ui';
import { getActiveBranchId } from '@/lib/branch';
import { useApi } from '@/lib/useApi';

/**
 * AI advisor (AI ileri, Faz 3): on-demand menu-engineering insights + review
 * sentiment summary. Business+ plan (server-gated); shows a clear message when
 * the plan lacks it or no AI key is configured.
 */
export function AiAdvisorCard() {
  const { api } = useApi();
  const [loading, setLoading] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [text, setText] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run(kind: 'menu' | 'reviews') {
    setLoading(kind);
    setError(null);
    setText(null);
    try {
      if (kind === 'menu') {
        const res = await api.aiMenuInsights(getActiveBranchId() ?? undefined);
        setTitle('Menü içgörüleri');
        setText(res.insights);
      } else {
        const res = await api.aiReviewSummary();
        setTitle('Yorum özeti');
        setText(res.summary);
      }
    } catch (e) {
      const s = (e as { status?: number })?.status;
      setError(
        s === 402
          ? 'AI Danışman Business plan ve üzeri içindir.'
          : s === 503
            ? 'AI anahtarı bu kurulumda yapılandırılmamış.'
            : s === 422
              ? 'Analiz için yeterli veri yok (satış/yorum).'
              : 'Bir hata oluştu.',
      );
    } finally {
      setLoading(null);
    }
  }

  return (
    <Card className="mb-6">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-ink">🤖 AI Danışman</h2>
        <span className="rounded-full bg-canvas px-2 py-0.5 text-[10px] font-semibold text-muted">Business+</span>
      </div>
      <p className="mt-1 text-xs text-muted">Satışlarınızdan ve yorumlarınızdan yapay zekâ önerileri alın.</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          onClick={() => run('menu')}
          disabled={!!loading}
          className="rounded-lg border border-line px-3 py-1.5 text-xs font-semibold text-ink transition hover:bg-canvas disabled:opacity-50"
        >
          {loading === 'menu' ? '…' : '📊 Menü içgörüleri'}
        </button>
        <button
          onClick={() => run('reviews')}
          disabled={!!loading}
          className="rounded-lg border border-line px-3 py-1.5 text-xs font-semibold text-ink transition hover:bg-canvas disabled:opacity-50"
        >
          {loading === 'reviews' ? '…' : '⭐ Yorum özeti'}
        </button>
      </div>
      {error && <p className="mt-3 text-xs text-red-600">{error}</p>}
      {text && (
        <div className="mt-3 rounded-xl bg-canvas p-3.5">
          <p className="mb-1 text-xs font-semibold text-ink">{title}</p>
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-ink">{text}</p>
        </div>
      )}
    </Card>
  );
}
