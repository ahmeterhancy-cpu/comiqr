'use client';

import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import Link from 'next/link';
import type { PlanOption } from '@comiqr/shared-types';
import { ApiError } from '@comiqr/shared-types/client';
import { Button, Card, Field, Input } from '@/components/ui';
import { useApi } from '@/lib/useApi';

const ORANGE: CSSProperties = {
  ['--color-brand-50' as string]: '#fff3ec',
  ['--color-brand-100' as string]: '#ffe1ce',
  ['--color-brand-500' as string]: '#ea5b1a',
  ['--color-brand-600' as string]: '#c9490f',
  ['--color-brand-700' as string]: '#9e3a0c',
};

type Status = Awaited<ReturnType<ReturnType<typeof useApi>['api']['subscriptionStatus']>>;

function fmtDate(iso: string | null): string {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' });
  } catch {
    return '';
  }
}

export default function BillingPage() {
  const { api, ready } = useApi();
  const [plans, setPlans] = useState<PlanOption[]>([]);
  const [status, setStatus] = useState<Status | null>(null);
  const [cycle, setCycle] = useState<'monthly' | 'yearly'>('monthly');
  const [selected, setSelected] = useState<string | null>(null);
  const [phone, setPhone] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!ready) return;
    Promise.all([api.plans(), api.subscriptionStatus()])
      .then(([p, s]) => {
        setPlans(p);
        setStatus(s);
        setPhone(s.owner_phone ?? '');
        const payable = p.filter((x) => Number(x.price_monthly) > 0);
        setSelected(s.plan_code && payable.some((x) => x.code === s.plan_code) ? s.plan_code : payable[0]?.code ?? null);
      })
      .catch(() => setError('Bilgiler yüklenemedi.'));
  }, [ready, api]);

  const payable = useMemo(() => plans.filter((p) => Number(p.price_monthly) > 0), [plans]);
  const chosen = payable.find((p) => p.code === selected) ?? null;
  const amount = chosen ? Number(cycle === 'yearly' ? chosen.price_yearly : chosen.price_monthly) : 0;

  async function subscribe() {
    if (!chosen) return;
    setBusy(true);
    setError(null);
    setDone(null);
    try {
      const res = await api.subscribe({ plan: chosen.code, billing_cycle: cycle, phone: phone.trim() || undefined });
      setDone(`${res.subscription.plan} aboneliği başlatıldı. Telefonunuza gönderilen SMS’teki linke tıklayıp ödemeyi onaylayın.`);
      api.subscriptionStatus().then(setStatus).catch(() => undefined);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Ödeme başlatılamadı, tekrar deneyin.');
    } finally {
      setBusy(false);
    }
  }

  if (!ready) {
    return <div className="grid min-h-screen place-items-center text-sm text-muted">Yükleniyor…</div>;
  }

  const sub = status?.subscription;
  const pending = sub?.status === 'pending_authorization';

  return (
    <div style={ORANGE} className="min-h-screen bg-canvas text-ink">
      <div className="mx-auto max-w-3xl px-5 py-10">
        <Link href="/dashboard" className="text-sm font-semibold text-brand-600 hover:underline">← Panele dön</Link>
        <h1 className="mt-3 text-2xl font-extrabold tracking-tight">Abonelik & Ödeme</h1>
        <p className="mt-1 text-sm text-muted">Planınızı seçin, Tiko ile güvenli tekrarlı ödeme başlatın.</p>

        {/* Status */}
        <Card className="mt-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-xs font-semibold uppercase tracking-wide text-muted">Mevcut durum</div>
              <div className="mt-1 text-lg font-bold">
                {status?.plan_name ?? 'Plan seçilmedi'}
                {status?.tenant_status === 'trialing' && status?.trial_ends_at && (
                  <span className="ml-2 rounded-full bg-brand-50 px-2.5 py-0.5 text-xs font-bold text-brand-700 align-middle">
                    Deneme · {fmtDate(status.trial_ends_at)} bitiyor
                  </span>
                )}
              </div>
            </div>
            {sub && (
              <span className={`rounded-full px-3 py-1 text-xs font-bold ${pending ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'}`}>
                {pending ? 'SMS onayı bekleniyor' : sub.status}
              </span>
            )}
          </div>
          {pending && (
            <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
              Aboneliğiniz başlatıldı. Telefonunuza gönderilen SMS’teki linke tıklayıp ödemeyi onaylayın; onay sonrası plan aktifleşir.
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
              >
                {c === 'monthly' ? 'Aylık' : 'Yıllık'}
              </button>
            ))}
          </div>
          {cycle === 'yearly' && <span className="text-xs font-semibold text-brand-600">2 ay hediye 🎉</span>}
        </div>

        {/* Plans */}
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {payable.map((p) => {
            const price = Number(cycle === 'yearly' ? p.price_yearly : p.price_monthly);
            const active = selected === p.code;
            return (
              <button
                key={p.code}
                type="button"
                onClick={() => setSelected(p.code)}
                className={`rounded-2xl border p-5 text-left transition ${active ? 'border-brand-500 bg-brand-50 ring-2 ring-brand-200' : 'border-line bg-surface hover:border-brand-300'}`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-base font-bold">{p.name}</span>
                  {active && <span className="grid h-5 w-5 place-items-center rounded-full bg-brand-500 text-white"><svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg></span>}
                </div>
                <div className="mt-2 text-2xl font-extrabold tracking-tight">
                  {price} {p.currency}<span className="text-sm font-semibold text-muted">/{cycle === 'yearly' ? 'yıl' : 'ay'}</span>
                </div>
                <div className="mt-2 flex flex-wrap gap-1">
                  {p.verticals.map((v) => (
                    <span key={v} className="rounded bg-white px-1.5 py-0.5 text-[10px] font-medium text-muted">{v}</span>
                  ))}
                </div>
              </button>
            );
          })}
        </div>

        {/* Phone + submit */}
        <Card className="mt-6">
          <Field label="Onay telefonu" hint="Tiko, ödeme onay linkini bu numaraya SMS ile gönderir.">
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} type="tel" placeholder="+90 5xx xxx xx xx" />
          </Field>

          {error && <div className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
          {done && <div className="mt-4 rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">{done}</div>}

          <div className="mt-5 flex items-center justify-between gap-4">
            <div className="text-sm text-muted">
              {chosen ? (
                <>Tahsil edilecek: <b className="text-ink">{amount} {chosen.currency}</b> / {cycle === 'yearly' ? 'yıl' : 'ay'}</>
              ) : (
                'Bir plan seçin'
              )}
            </div>
            <Button onClick={subscribe} loading={busy} disabled={!chosen || !phone.trim()}>
              {busy ? 'Başlatılıyor…' : 'Aboneliği Başlat'}
            </Button>
          </div>
        </Card>

        <p className="mt-4 text-center text-xs text-muted">
          Ödemeler Tiko altyapısıyla, 3D Secure ile güvenle alınır. İstediğiniz an iptal edebilirsiniz.
        </p>
      </div>
    </div>
  );
}
