'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { OnboardingWizard } from '@/components/OnboardingWizard';
import { useApi } from '@/lib/useApi';

export default function OnboardingPage() {
  const { api, me, ready } = useApi();
  const router = useRouter();
  const [tenant, setTenant] = useState<any | null>(null);
  const [open, setOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!ready) return;
    api
      .getTenant()
      .then((t) => {
        // Already set up → straight to the dashboard.
        if (t?.settings?.onboarding?.completed) {
          router.replace('/dashboard');
          return;
        }
        setTenant(t);
        setLoaded(true);
        setOpen(true); // open the wizard immediately for a fresh account
      })
      .catch(() => setLoaded(true));
  }, [ready, api, router]);

  const firstName = (me?.user.name ?? '').split(' ')[0] || '';

  if (!ready || !loaded) {
    return <div className="grid min-h-screen place-items-center text-sm text-muted">Yükleniyor…</div>;
  }

  return (
    <div className="min-h-screen bg-canvas text-ink">
      <div className="mx-auto max-w-3xl px-5 py-14">
        <div className="mb-1 flex items-center gap-2 text-sm font-extrabold tracking-tight text-brand-600">
          <span className="grid h-7 w-7 place-items-center rounded-lg bg-brand-500 text-white" style={{ color: '#ffffff' }}>Q</span>
          ComiQR
        </div>
        <h1 className="mt-6 text-2xl font-extrabold tracking-tight">
          {firstName ? `Hoş geldin ${firstName}!` : 'Hoş geldin!'} İşletmeni kuralım.
        </h1>
        <p className="mt-1.5 text-sm text-muted">
          Menünü yayına almadan önce birkaç adımda işletme profilini oluştur. Dilediğin zaman Ayarlar’dan güncelleyebilirsin.
        </p>

        <div className="mt-8 text-xs font-semibold uppercase tracking-wide text-muted">İşletmen</div>
        <div className="mt-2 border-t border-line pt-5">
          {/* "Create New Location"–style entry card */}
          <div className="rounded-2xl border-2 border-dashed border-line bg-surface p-5">
            <div className="flex items-start gap-3">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-600">
                <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" /><circle cx="12" cy="10" r="3" /></svg>
              </span>
              <div>
                <div className="text-base font-bold text-ink">İşletmeni Oluştur</div>
                <div className="text-sm text-muted">Adım adım profilini kur (ad, tür, saatler, iletişim, görünüm)</div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setOpen(true)}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-line bg-white py-2.5 text-sm font-bold text-ink transition hover:border-brand-300 hover:bg-canvas"
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14" /></svg>
              Kuruluma Başla
            </button>
          </div>
        </div>
      </div>

      {open && tenant && (
        <OnboardingWizard
          api={api}
          tenant={tenant}
          onClose={() => setOpen(false)}
          onDone={() => router.replace('/dashboard')}
        />
      )}
    </div>
  );
}
