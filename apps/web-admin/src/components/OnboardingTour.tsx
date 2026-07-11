'use client';

import { useEffect, useState } from 'react';

const KEY = 'cq.onboarded';

type Step = { title: string; body: string; pos: 'right' | 'left' | 'center'; cta: string };

const STEPS: Step[] = [
  {
    title: 'Dilinizi seçin',
    body: 'Sağ üstteki menüden panelin dilini ayarlayın (Türkçe / English). Dilediğiniz an değiştirebilirsiniz.',
    pos: 'right',
    cta: 'Devam',
  },
  {
    title: 'ComiQR’a hoş geldiniz',
    body: 'ComiQR, dijital menünüzü yönetmek için bir sistemdir. Menünüzü burada oluşturup güncellersiniz; misafirleriniz QR kodunu okutup telefonlarında açar. Hadi birlikte kuralım.',
    pos: 'center',
    cta: 'Başlayalım',
  },
];

/** First-visit onboarding tour on the dashboard. Shows once (localStorage flag). */
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
  const centered = step.pos === 'center';

  const finish = () => {
    try {
      localStorage.setItem(KEY, '1');
    } catch {
      /* ignore */
    }
    setI(null);
  };
  const next = () => (i < STEPS.length - 1 ? setI(i + 1) : finish());
  const back = () => setI(Math.max(0, i - 1));

  const posCls = centered
    ? 'left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[420px] text-center'
    : step.pos === 'right'
      ? 'right-4 top-[4.5rem] w-[330px] lg:right-8'
      : 'left-4 top-[4.5rem] w-[330px] lg:left-[18.5rem]';

  return (
    <div className="fixed inset-0 z-[60]">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-[1px]" onClick={finish} />
      <div className={`absolute max-w-[calc(100vw-2rem)] rounded-2xl border border-line bg-surface p-6 shadow-2xl ${posCls}`}>
        <div className={`flex items-start ${centered ? 'justify-center' : 'justify-between'} relative`}>
          <span className="text-xs font-bold uppercase tracking-widest text-brand-600">
            {i + 1} / {STEPS.length}
          </span>
          <button type="button" onClick={finish} aria-label="Kapat" className={`text-muted transition hover:text-ink ${centered ? 'absolute right-0 top-0' : ''}`}>
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><path d="m6 6 12 12M18 6 6 18" /></svg>
          </button>
        </div>

        <h3 className={`mt-2 font-bold text-ink ${centered ? 'text-xl' : 'text-lg'}`}>{step.title}</h3>
        <p className="mt-2 text-sm leading-relaxed text-muted">{step.body}</p>

        <div className={`mt-5 flex items-center gap-3 ${centered ? 'justify-center' : 'justify-between'}`}>
          {i > 0 ? (
            <button type="button" onClick={back} className="inline-flex items-center gap-1.5 rounded-xl border border-line px-4 py-2 text-sm font-semibold text-ink transition hover:bg-canvas">
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M11 6l-6 6 6 6" /></svg>
              Geri
            </button>
          ) : (
            !centered && <button type="button" onClick={finish} className="text-sm font-medium text-muted transition hover:text-ink">Geç</button>
          )}
          <button type="button" onClick={next} className="inline-flex items-center gap-1.5 rounded-xl bg-brand-500 px-5 py-2 text-sm font-bold text-white transition hover:bg-brand-600">
            {step.cta}
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
          </button>
        </div>
      </div>
    </div>
  );
}
