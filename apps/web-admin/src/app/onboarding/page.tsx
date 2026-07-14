'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { BrandLogo } from '@/components/BrandLogo';
import { OnboardingWizard } from '@/components/OnboardingWizard';
import { useApi } from '@/lib/useApi';

export default function OnboardingPage() {
  const { api, me, ready } = useApi();
  const t = useTranslations('onboarding');
  const c = useTranslations('common');
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
    return <div className="grid min-h-screen place-items-center text-sm text-muted">{c('loading')}</div>;
  }

  return (
    <div className="min-h-screen bg-canvas text-ink">
      <div className="mx-auto max-w-3xl px-5 py-14">
        <div className="mb-1">
          <BrandLogo className="h-7 w-auto" />
        </div>
        <h1 className="mt-6 text-2xl font-extrabold tracking-tight">
          {firstName ? t('welcomeNamed', { name: firstName }) : t('welcome')}
        </h1>
        <p className="mt-1.5 text-sm text-muted">
          {t('pageSubtitle')}
        </p>

        <div className="mt-8 text-xs font-semibold uppercase tracking-wide text-muted">{t('yourBusiness')}</div>
        <div className="mt-2 border-t border-line pt-5">
          {/* "Create New Location"–style entry card */}
          <div className="rounded-2xl border-2 border-dashed border-line bg-surface p-5">
            <div className="flex items-start gap-3">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-600">
                <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" /><circle cx="12" cy="10" r="3" /></svg>
              </span>
              <div>
                <div className="text-base font-bold text-ink">{t('createBusiness')}</div>
                <div className="text-sm text-muted">{t('createBusinessHint')}</div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setOpen(true)}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-line bg-white py-2.5 text-sm font-bold text-ink transition hover:border-brand-300 hover:bg-canvas"
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14" /></svg>
              {t('startSetup')}
            </button>
          </div>
        </div>
      </div>

      {open && tenant && (
        <OnboardingWizard
          api={api}
          tenant={tenant}
          owner={me?.user}
          onClose={() => setOpen(false)}
          onDone={() => router.replace('/dashboard')}
        />
      )}
    </div>
  );
}
