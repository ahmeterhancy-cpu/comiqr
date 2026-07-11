'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { createApi } from '@/lib/api';
import { getToken } from '@/lib/auth';

type Status = Awaited<ReturnType<ReturnType<typeof createApi>['subscriptionStatus']>>;

const TRIAL_TOTAL_MS = 14 * 24 * 3600 * 1000; // registration grants a 14-day trial

/** Plan / trial status card for the sidebar (above the system-status card). */
export function TrialCard() {
  const [st, setSt] = useState<Status | null>(null);

  useEffect(() => {
    createApi(getToken()).subscriptionStatus().then(setSt).catch(() => undefined);
  }, []);

  if (!st) return null;

  const trialing = st.tenant_status === 'trialing' && !!st.trial_ends_at;
  const active = st.tenant_status === 'active' || st.subscription?.status === 'active';
  const planName = st.plan_name ?? (trialing ? 'Deneme' : 'Ücretsiz');

  let remainingText = '';
  let pct = 0;
  if (trialing && st.trial_ends_at) {
    const remMs = Math.max(0, new Date(st.trial_ends_at).getTime() - Date.now());
    pct = Math.min(100, Math.max(0, Math.round(((TRIAL_TOTAL_MS - remMs) / TRIAL_TOTAL_MS) * 100)));
    if (remMs <= 0) {
      remainingText = 'Deneme bitti';
      pct = 100;
    } else {
      const d = Math.floor(remMs / 86_400_000);
      const h = Math.floor((remMs % 86_400_000) / 3_600_000);
      remainingText = `${d}g ${h}s kaldı`;
    }
  }

  return (
    <Link href="/billing" className="mt-4 block rounded-2xl bg-white/5 p-3.5 transition hover:bg-white/10">
      <span
        className={`inline-block rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
          trialing ? 'bg-sky-400/20 text-sky-300' : active ? 'bg-emerald-400/20 text-emerald-300' : 'bg-white/10 text-slate-300'
        }`}
      >
        {trialing ? 'Ücretsiz Deneme' : active ? 'Aktif' : 'Plan'}
      </span>
      <div className="mt-1.5 text-base font-extrabold text-white">{planName}</div>
      <div className="text-[11px] text-slate-400">{trialing ? 'Deneme sürümündesiniz' : 'Planınızı yönetin'}</div>

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
    </Link>
  );
}
