'use client';

import { Suspense, useEffect, useState, type CSSProperties } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import type { PlanOption } from '@comiqr/shared-types';
import { ApiError } from '@comiqr/shared-types/client';
import { Button, Card } from '@/components/ui';
import { useApi } from '@/lib/useApi';

const ORANGE: CSSProperties = {
  ['--color-brand-50' as string]: '#fff3ec',
  ['--color-brand-100' as string]: '#ffe1ce',
  ['--color-brand-500' as string]: '#ea5b1a',
  ['--color-brand-600' as string]: '#c9490f',
  ['--color-brand-700' as string]: '#9e3a0c',
};

type Status = Awaited<ReturnType<ReturnType<typeof useApi>['api']['subscriptionStatus']>>;
type Checkout = Awaited<ReturnType<ReturnType<typeof useApi>['api']['subscribe']>>;

function fmtDate(iso: string | null): string {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' });
  } catch {
    return '';
  }
}

export default function BillingPage() {
  const c = useTranslations('common');
  return (
    <Suspense fallback={<div className="grid min-h-screen place-items-center text-sm text-muted">{c('loading')}</div>}>
      <BillingInner />
    </Suspense>
  );
}

function BillingInner() {
  const t = useTranslations('billing');
  const c = useTranslations('common');
  const { api, ready } = useApi();
  const params = useSearchParams();
  const [plans, setPlans] = useState<PlanOption[]>([]);
  const [status, setStatus] = useState<Status | null>(null);
  const [cycle, setCycle] = useState<'monthly' | 'yearly'>('monthly');
  const [selected, setSelected] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [checkout, setCheckout] = useState<Checkout | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Result of the 3DS browser-return (Tiko redirects to ?billing=success|failed|error).
  const returned = params.get('billing');

  useEffect(() => {
    if (!ready) return;
    Promise.all([api.plans(), api.subscriptionStatus()])
      .then(([p, s]) => {
        setPlans(p);
        setStatus(s);
        const payable = p.filter((x) => Number(x.price_monthly) > 0);
        setSelected(s.plan_code && payable.some((x) => x.code === s.plan_code) ? s.plan_code : payable[0]?.code ?? null);
      })
      .catch(() => setError(c('loadError')));
  }, [ready, api]);

  const chosen = plans.find((p) => p.code === selected && Number(p.price_monthly) > 0) ?? null;
  const amount = chosen ? Number(cycle === 'yearly' ? chosen.price_yearly : chosen.price_monthly) : 0;

  const sub = status?.subscription;
  const pastDue = sub?.status === 'past_due';
  const pending = sub?.status === 'pending_authorization';

  /** Fetch the Tiko pay3d session, then reveal the card form (card → Tiko, not us). */
  async function startCheckout() {
    if (!chosen) return;
    setBusy(true);
    setError(null);
    try {
      const res = await api.subscribe({ plan: chosen.code, billing_cycle: cycle });
      setCheckout(res);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('paymentStartFailed'));
    } finally {
      setBusy(false);
    }
  }

  if (!ready) {
    return <div className="grid min-h-screen place-items-center text-sm text-muted">{c('loading')}</div>;
  }

  return (
    <div style={ORANGE} className="min-h-screen bg-canvas text-ink">
      <div className="mx-auto max-w-3xl px-5 py-10">
        <Link href="/dashboard" className="text-sm font-semibold text-brand-600 hover:underline">← {t('backToPanel')}</Link>
        <h1 className="mt-3 text-2xl font-extrabold tracking-tight">{t('title')}</h1>
        <p className="mt-1 text-sm text-muted">{t('subtitle')}</p>

        {/* Return banner (3DS result) */}
        {returned === 'success' && (
          <div className="mt-5 rounded-xl bg-green-50 px-4 py-3 text-sm font-semibold text-green-800">
            ✓ {t('returnSuccess')}
          </div>
        )}
        {(returned === 'failed' || returned === 'error') && (
          <div className="mt-5 rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
            {t('returnFailed')}
          </div>
        )}

        {checkout ? (
          <TikoCardForm
            session={checkout.session}
            amount={checkout.subscription.amount}
            currency={checkout.subscription.currency}
            planName={checkout.subscription.plan}
            cycle={cycle}
            onBack={() => setCheckout(null)}
          />
        ) : (
          <>
            {/* Status */}
            <Card className="mt-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wide text-muted">{t('currentStatus')}</div>
                  <div className="mt-1 text-lg font-bold">
                    {status?.plan_name ?? t('noPlanSelected')}
                    {status?.tenant_status === 'trialing' && status?.trial_ends_at && (
                      <span className="ml-2 rounded-full bg-brand-50 px-2.5 py-0.5 text-xs font-bold text-brand-700 align-middle">
                        {t('trialEndsAt', { date: fmtDate(status.trial_ends_at) })}
                      </span>
                    )}
                  </div>
                  {sub?.card_last4 && (
                    <div className="mt-1 text-xs text-muted">
                      {t('savedCard')} {sub.card_brand ? `${sub.card_brand} ` : ''}•••• {sub.card_last4}
                    </div>
                  )}
                </div>
                {sub && (
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-bold ${
                      pastDue ? 'bg-red-100 text-red-700' : pending ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'
                    }`}
                  >
                    {pastDue ? t('statusPastDue') : pending ? t('statusPending') : sub.status === 'active' ? c('active') : sub.status}
                  </span>
                )}
              </div>

              {/* Payment failed → prompt to update the card */}
              {pastDue && (
                <div className="mt-3 rounded-lg bg-red-50 px-3 py-2.5 text-sm text-red-800">
                  {t('pastDueLead')}
                  {sub?.grace_ends_at && <> — {t('graceUntil', { date: fmtDate(sub.grace_ends_at) })}</>}. {t('pastDueAction')}
                </div>
              )}
              {pending && (
                <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
                  {t('pendingNotice')}
                </p>
              )}
            </Card>

            {/* Cycle toggle */}
            <div className="mt-6 flex items-center gap-2">
              <div className="inline-flex rounded-xl border border-line bg-surface p-1">
                {(['monthly', 'yearly'] as const).map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setCycle(c)}
                    className={`rounded-lg px-4 py-1.5 text-sm font-semibold transition ${cycle === c ? 'bg-brand-500 text-white' : 'text-muted hover:text-ink'}`}
                    style={cycle === c ? { color: '#ffffff' } : undefined}
                  >
                    {c === 'monthly' ? t('monthly') : t('yearly')}
                  </button>
                ))}
              </div>
              {cycle === 'yearly' && <span className="text-xs font-semibold text-brand-600">{t('yearlyBonus')} 🎉</span>}
            </div>

            {/* Plans — all packages; payable ones selectable, free/enterprise informational */}
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              {plans.map((p) => {
                const price = Number(cycle === 'yearly' ? p.price_yearly : p.price_monthly);
                const payable = price > 0;
                const active = selected === p.code;
                const current = status?.plan_code === p.code;
                const verticals = (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {p.verticals.map((v) => (
                      <span key={v} className="rounded bg-white px-1.5 py-0.5 text-[10px] font-medium text-muted">{v}</span>
                    ))}
                  </div>
                );
                const head = (
                  <div className="flex items-center justify-between">
                    <span className="text-base font-bold">
                      {p.name}
                      {current && <span className="ml-2 rounded-full bg-brand-100 px-2 py-0.5 align-middle text-[10px] font-bold text-brand-700">{t('current')}</span>}
                    </span>
                    {payable && active && (
                      <span className="grid h-5 w-5 place-items-center rounded-full bg-brand-500 text-white">
                        <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
                      </span>
                    )}
                  </div>
                );

                if (payable) {
                  return (
                    <button
                      key={p.code}
                      type="button"
                      onClick={() => setSelected(p.code)}
                      className={`rounded-2xl border p-5 text-left transition ${active ? 'border-brand-500 bg-brand-50 ring-2 ring-brand-200' : 'border-line bg-surface hover:border-brand-300'}`}
                    >
                      {head}
                      <div className="mt-2 text-2xl font-extrabold tracking-tight">
                        {price} {p.currency}<span className="text-sm font-semibold text-muted">/{cycle === 'yearly' ? t('year') : t('month')}</span>
                      </div>
                      {verticals}
                    </button>
                  );
                }

                const isEnterprise = p.code === 'enterprise';
                return (
                  <div key={p.code} className="rounded-2xl border border-line bg-surface p-5">
                    {head}
                    <div className="mt-2 text-2xl font-extrabold tracking-tight">
                      {isEnterprise ? t('custom') : t('free')}
                      {!isEnterprise && <span className="text-sm font-semibold text-muted"> / {t('month')}</span>}
                    </div>
                    {verticals}
                    <div className="mt-3 text-xs">
                      {isEnterprise ? (
                        <a href="/iletisim" className="inline-flex rounded-lg border border-line px-3 py-1.5 font-bold text-ink transition hover:bg-canvas">{t('contactUs')}</a>
                      ) : current ? (
                        <span className="font-semibold text-brand-600">{t('currentPlan')}</span>
                      ) : (
                        <span className="text-muted">{t('noPaymentRequired')}</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Continue to card entry */}
            <Card className="mt-6">
              {error && <div className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

              <div className="flex items-center justify-between gap-4">
                <div className="text-sm text-muted">
                  {chosen ? (
                    <>{t('toCharge')} <b className="text-ink">{amount} {chosen.currency}</b> / {cycle === 'yearly' ? t('year') : t('month')}</>
                  ) : (
                    t('selectPlan')
                  )}
                </div>
                <Button onClick={startCheckout} loading={busy} disabled={!chosen}>
                  {busy ? t('preparing') : pastDue ? t('updateCardPay') : t('continueToCard')}
                </Button>
              </div>
            </Card>

            <p className="mt-4 text-center text-xs text-muted">
              {t('securityNote')}
            </p>
          </>
        )}
      </div>
    </div>
  );
}

/**
 * Card entry that POSTs straight to Tiko's pay3d — card data goes browser→Tiko,
 * never our server (PCI). The hidden fields (incl. the server-built Hash) come from
 * the checkout session; the browser adds CardName/CardNo/expiry/CVV.
 */
function TikoCardForm({
  session,
  amount,
  currency,
  planName,
  cycle,
  onBack,
}: {
  session: Checkout['session'];
  amount: number;
  currency: string;
  planName: string;
  cycle: 'monthly' | 'yearly';
  onBack: () => void;
}) {
  const t = useTranslations('billing');
  const stored = 'CardId' in session.meta.fields;
  return (
    <Card className="mt-6">
      <button type="button" onClick={onBack} className="text-sm font-semibold text-brand-600 hover:underline">← {t('backToPlans')}</button>
      <h2 className="mt-3 text-lg font-bold">{t('payWithCard')} · {amount} {currency} / {cycle === 'yearly' ? t('year') : t('month')}</h2>
      <p className="mt-1 text-sm text-muted">
        {t('subscriptionOf', { plan: planName })} {stored ? t('storedCardNote') : t('newCardNote')}
      </p>

      <form method="POST" action={session.url} className="mt-5 space-y-3">
        {Object.entries(session.meta.fields).map(([k, v]) => (
          <input key={k} type="hidden" name={k} value={v} />
        ))}
        {!stored && (
          <>
            <CardField name="CardName" label={t('cardName')} placeholder={t('cardNamePlaceholder')} />
            <CardField name="CardNo" label={t('cardNumber')} placeholder="0000 0000 0000 0000" inputMode="numeric" autoComplete="cc-number" />
            <div className="grid grid-cols-3 gap-2">
              <CardField name="CardExpireMonth" label={t('expMonth')} placeholder="12" inputMode="numeric" autoComplete="cc-exp-month" />
              <CardField name="CardExpireYear" label={t('expYear')} placeholder="27" inputMode="numeric" autoComplete="cc-exp-year" />
              <CardField name="CardCvv" label={t('cvv')} placeholder="123" inputMode="numeric" autoComplete="cc-csc" />
            </div>
          </>
        )}
        <button
          type="submit"
          className="w-full rounded-xl bg-brand-500 py-3.5 text-sm font-bold text-white transition hover:bg-brand-600"
          style={{ color: '#ffffff' }}
        >
          {amount} {currency} {t('payAndStart')}
        </button>
      </form>

      <p className="mt-3 flex items-center justify-center gap-1.5 text-center text-xs text-muted">
        <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
        {t('secureFooter')}
      </p>
    </Card>
  );
}

function CardField({
  name,
  label,
  placeholder,
  inputMode,
  autoComplete,
}: {
  name: string;
  label: string;
  placeholder: string;
  inputMode?: 'numeric';
  autoComplete?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-muted">{label}</span>
      <input
        name={name}
        required
        inputMode={inputMode}
        autoComplete={autoComplete}
        placeholder={placeholder}
        className="w-full rounded-xl border border-line bg-surface px-3.5 py-2.5 text-sm outline-none focus:border-brand-500 focus:bg-white"
      />
    </label>
  );
}
