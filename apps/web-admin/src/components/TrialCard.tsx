'use client';

import { useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import Link from 'next/link';
import { createApi } from '@/lib/api';
import { getToken } from '@/lib/auth';

type Status = Awaited<ReturnType<ReturnType<typeof createApi>['subscriptionStatus']>>;

const TRIAL_TOTAL_MS = 14 * 24 * 3600 * 1000; // registration grants a 14-day trial

function fmtDate(iso: string | null | undefined, locale: string): string {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric' });
  } catch {
    return '';
  }
}

function daysLeft(iso: string | null | undefined): number {
  if (!iso) return 0;
  return Math.max(0, Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000));
}

/** Plan / trial / past-due status card for the sidebar (above system-status). */
export function TrialCard() {
  const t = useTranslations('shell');
  const c = useTranslations('common');
  const locale = useLocale();
  const [st, setSt] = useState<Status | null>(null);

  useEffect(() => {
    createApi(getToken()).subscriptionStatus().then(setSt).catch(() => undefined);
  }, []);

  if (!st) return null;

  const sub = st.subscription;
  const pastDue = sub?.status === 'past_due';
  const trialing = !pastDue && st.tenant_status === 'trialing' && !!st.trial_ends_at;
  const planName = st.plan_name ?? (trialing ? t('trialPlan') : t('freePlan'));
  const endDate = fmtDate(trialing ? st.trial_ends_at : sub?.current_period_end, locale);

  // Payment failed → warning + remaining grace days.
  if (pastDue) {
    const grace = daysLeft(sub?.grace_ends_at);
    return (
      <Link href="/billing" className="mt-4 block rounded-2xl border border-red-400/40 bg-red-500/10 p-3.5 transition hover:bg-red-500/15">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-red-500/25 px-2.5 py-0.5 text-[11px] font-bold text-red-200">
          <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><path d="M12 8v5M12 17v.01M10.3 3.9 2 18a2 2 0 0 0 1.7 3h16.6a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" /></svg>
          {t('paymentFailed')}
        </span>
        <div className="mt-1.5 text-base font-extrabold text-white">{planName}</div>
        <div className="text-[11px] text-red-200/90">{t('paymentFailedDesc')}</div>
        <div className="mt-2 rounded-lg bg-white/10 px-2.5 py-1.5 text-[11px] font-semibold text-white">
          {grace > 0 ? t('graceDays', { days: grace }) : t('graceEnded')}
        </div>
        <span className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-xl bg-red-500 py-2 text-sm font-bold text-white">
          {t('completePayment')}
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
        </span>
      </Link>
    );
  }

  let remainingText = '';
  let pct = 0;
  if (trialing && st.trial_ends_at) {
    const remMs = Math.max(0, new Date(st.trial_ends_at).getTime() - Date.now());
    pct = Math.min(100, Math.max(0, Math.round(((TRIAL_TOTAL_MS - remMs) / TRIAL_TOTAL_MS) * 100)));
    if (remMs <= 0) {
      remainingText = t('trialEnded');
      pct = 100;
    } else {
      const d = Math.floor(remMs / 86_400_000);
      const h = Math.floor((remMs % 86_400_000) / 3_600_000);
      remainingText = t('remaining', { d, h });
    }
  }

  return (
    <div className="mt-4 rounded-2xl bg-white/5 p-3.5">
      <span
        className={`inline-block rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
          trialing ? 'bg-sky-400/20 text-sky-300' : 'bg-emerald-400/20 text-emerald-300'
        }`}
      >
        {trialing ? t('freeTrial') : c('active')}
      </span>
      <div className="mt-1.5 text-base font-extrabold text-white">{planName}</div>
      <div className="text-[11px] text-slate-400">{trialing ? t('onTrial') : t('subActive')}</div>

      {trialing && (
        <>
          <div className="mt-2.5 flex items-center justify-between text-[11px] font-semibold text-slate-300">
            <span>{remainingText}</span>
            <span>{pct}%</span>
          </div>
          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/10">
            <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: 'linear-gradient(90deg,#14b8a6,#0ea5e9)' }} />
          </div>
        </>
      )}

      {endDate && (
        <div className="mt-2.5 flex items-center gap-1.5 text-[11px] text-slate-400">
          <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="17" rx="2" /><path d="M3 9h18M8 2v4M16 2v4" /></svg>
          {t('endsOn', { date: endDate })}
        </div>
      )}

      <Link href="/billing" className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-xl py-2 text-sm font-bold text-white transition" style={{ background: 'linear-gradient(135deg,#14b8a6,#0ea5e9)' }}>
        {t('subscribe')}
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round"><path d="M9 6l6 6-6 6" /></svg>
      </Link>
    </div>
  );
}
