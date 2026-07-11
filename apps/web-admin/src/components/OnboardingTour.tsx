'use client';

import { useEffect, useState } from 'react';

const KEY = 'cq.onboarded';

const STEPS: { title: string; body: string; pos: 'right' | 'left' }[] = [
  {
    title: 'Dilinizi seçin',
    body: 'Sağ üstteki menüden panelin dilini ayarlayın (Türkçe / English). Dilediğiniz an değiştirebilirsiniz.',
    pos: 'right',
  },
  {
    title: 'Menünüzü oluşturun',
    body: 'Sol menüdeki “Menü”den kategori ve ürünleri ekleyin — ya da fotoğraftan otomatik içe aktarın. QR’ınız hazır olsun.',
    pos: 'left',
  },
];

/** First-visit coach-mark tour on the dashboard. Shows once (localStorage flag). */
export function OnboardingTour() {
  const [i, setI] = useState<number | null>(null);

  useEffect(() => {
    try {
      if (!localStorage.getItem(KEY)) setI(0);
    } catch {
      /* private mode */
    }
  }, []);

  if (i === null) return null;

  const step = STEPS[i];
  const finish = () => {
    try {
      localStorage.setItem(KEY, '1');
    } catch {
      /* ignore */
    }
    setI(null);
  };
  const next = () => (i < STEPS.length - 1 ? setI(i + 1) : finish());

  return (
    <div className="fixed inset-0 z-[60]">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-[1px]" onClick={finish} />
      <div
        className={`absolute top-[4.5rem] w-[330px] max-w-[calc(100vw-2rem)] rounded-2xl border border-line bg-surface p-5 shadow-2xl ${
          step.pos === 'right' ? 'right-4 lg:right-8' : 'left-4 lg:left-[18.5rem]'
        }`}
      >
        <div className="flex items-start justify-between">
          <span className="text-xs font-bold uppercase tracking-widest text-brand-600">
            {i + 1} / {STEPS.length}
          </span>
          <button type="button" onClick={finish} aria-label="Kapat" className="text-muted transition hover:text-ink">
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><path d="m6 6 12 12M18 6 6 18" /></svg>
          </button>
        </div>
        <h3 className="mt-1.5 text-lg font-bold text-ink">{step.title}</h3>
        <p className="mt-2 text-sm leading-relaxed text-muted">{step.body}</p>
        <div className="mt-4 flex items-center justify-between">
          <button type="button" onClick={finish} className="text-sm font-medium text-muted transition hover:text-ink">Geç</button>
          <button type="button" onClick={next} className="inline-flex items-center gap-1.5 rounded-xl bg-brand-500 px-5 py-2 text-sm font-bold text-white transition hover:bg-brand-600">
            {i < STEPS.length - 1 ? 'Devam' : 'Bitir'}
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
          </button>
        </div>
      </div>
    </div>
  );
}
