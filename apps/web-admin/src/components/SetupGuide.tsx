'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createApi } from '@/lib/api';
import { getToken, getUser } from '@/lib/auth';

const HIDDEN = 'cq.setup.hidden';

type Step = { key: string; label: string; done: boolean; href: string | null; flag?: boolean };

/** Persistent getting-started checklist, opened from a progress badge in the top bar. */
export function SetupGuide() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [hidden, setHidden] = useState(true);
  const [name, setName] = useState('');
  const [langDone, setLangDone] = useState(false);
  const [hasAddress, setHasAddress] = useState(false);
  const [hasMenu, setHasMenu] = useState(false);
  const [flags, setFlags] = useState<Record<string, boolean>>({});

  useEffect(() => {
    try {
      setHidden(!!localStorage.getItem(HIDDEN));
      setFlags({
        explore: !!localStorage.getItem('cq.setup.explore'),
        profile: !!localStorage.getItem('cq.setup.profile'),
      });
    } catch {
      /* ignore */
    }
    setName((getUser()?.name ?? '').split(' ')[0] || '');
    setLangDone(typeof document !== 'undefined' && document.cookie.includes('locale='));

    const api = createApi(getToken());
    api.getTenant().then((t: any) => setHasAddress(!!(t?.settings?.address || t?.settings?.logo))).catch(() => undefined);
    api.adminCategories().then((c) => setHasMenu((c?.length ?? 0) > 0)).catch(() => undefined);
  }, []);

  const steps: Step[] = [
    { key: 'lang', label: 'Dilinizi seçin', done: langDone, href: null },
    { key: 'venue', label: 'Mekanınızı hazırlayın', done: hasAddress, href: '/settings' },
    { key: 'menu', label: 'Menünüzü oluşturun', done: hasMenu, href: '/menu' },
    { key: 'explore', label: 'Başka neler yapabileceğinize bakın', done: !!flags.explore, href: '/integrations', flag: true },
    { key: 'profile', label: 'Profilinizi tanıyın', done: !!flags.profile, href: '/settings', flag: true },
  ];
  const total = steps.length;
  const doneCount = steps.filter((s) => s.done).length;

  if (hidden || doneCount === total) return null;

  const go = (s: Step) => {
    if (s.flag) {
      try {
        localStorage.setItem(`cq.setup.${s.key}`, '1');
      } catch {
        /* ignore */
      }
    }
    setOpen(false);
    if (s.href) router.push(s.href);
  };
  const continueSetup = () => {
    const first = steps.find((s) => !s.done);
    if (first) go(first);
  };
  const dismiss = () => {
    try {
      localStorage.setItem(HIDDEN, '1');
    } catch {
      /* ignore */
    }
    setHidden(true);
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 rounded-full border border-line bg-surface py-1 pl-3 pr-1.5 text-sm font-semibold text-ink transition hover:bg-canvas"
      >
        Kurulum
        <span className="rounded-full px-2 py-0.5 text-xs font-bold text-white" style={{ background: 'linear-gradient(135deg,#14b8a6,#0ea5e9)' }}>{doneCount}/{total}</span>
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-50 mt-2 w-[340px] max-w-[calc(100vw-1.5rem)] rounded-2xl border border-line bg-surface p-5 shadow-2xl">
            <div className="flex items-start justify-between">
              <h3 className="text-base font-bold text-ink">Hadi başlayalım{name ? `, ${name}` : ''}.</h3>
              <button type="button" onClick={dismiss} aria-label="Gizle" className="text-muted transition hover:text-ink">
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><path d="m6 6 12 12M18 6 6 18" /></svg>
              </button>
            </div>

            <div className="mt-3 flex items-center justify-between text-xs font-semibold text-muted">
              <span>Mekanınızı misafirler için hazırlayın</span>
              <span>{doneCount}/{total}</span>
            </div>
            <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-canvas">
              <div className="h-full rounded-full transition-all" style={{ width: `${(doneCount / total) * 100}%`, background: 'linear-gradient(90deg,#14b8a6,#0ea5e9)' }} />
            </div>

            <ul className="mt-4 space-y-1">
              {steps.map((s) => (
                <li key={s.key}>
                  <button
                    type="button"
                    onClick={() => go(s)}
                    disabled={!s.href}
                    className={`flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left text-sm transition ${s.href ? 'hover:bg-canvas' : 'cursor-default'}`}
                  >
                    {s.done ? (
                      <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-brand-500 text-white">
                        <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth={3.2} strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
                      </span>
                    ) : (
                      <span className="h-5 w-5 shrink-0 rounded-full border-2 border-line" />
                    )}
                    <span className={s.done ? 'text-muted line-through' : 'font-semibold text-ink'}>{s.label}</span>
                  </button>
                </li>
              ))}
            </ul>

            <button
              type="button"
              onClick={continueSetup}
              className="mt-4 w-full rounded-xl py-2.5 text-center text-sm font-bold text-white transition"
              style={{ background: 'linear-gradient(135deg,#14b8a6,#0ea5e9)' }}
            >
              Kuruluma devam et
            </button>
          </div>
        </>
      )}
    </div>
  );
}
