'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import type { PlanOption } from '@comiqr/shared-types';
import { ApiError } from '@comiqr/shared-types/client';
import { AuthShell } from '@/components/AuthShell';
import { Button, Card, Field, Input } from '@/components/ui';
import { createApi } from '@/lib/api';
import { setSession } from '@/lib/auth';

const VERTICALS: { value: string; label: string; icon: string }[] = [
  { value: 'restaurant', label: 'Restoran / Kafe', icon: '🍽️' },
  { value: 'hotel', label: 'Otel', icon: '🛏️' },
  { value: 'beach', label: 'Plaj Kulübü', icon: '⛱️' },
  { value: 'bar', label: 'Bar / Pub', icon: '🍹' },
];

export default function RegisterPage() {
  const t = useTranslations('auth');
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [general, setGeneral] = useState<string | null>(null);

  const [plans, setPlans] = useState<PlanOption[]>([]);
  const [planCode, setPlanCode] = useState('free');
  const [vertical, setVertical] = useState('restaurant');

  useEffect(() => {
    createApi()
      .plans()
      .then(setPlans)
      .catch(() => undefined);
  }, []);

  const allowed = plans.find((p) => p.code === planCode)?.verticals ?? ['restaurant'];

  function pickPlan(code: string) {
    setPlanCode(code);
    const verts = plans.find((p) => p.code === code)?.verticals ?? ['restaurant'];
    if (!verts.includes(vertical)) setVertical('restaurant');
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setErrors({});
    setGeneral(null);

    const form = new FormData(e.currentTarget);
    try {
      const res = await createApi().registerTenant({
        business_name: String(form.get('business_name') ?? ''),
        owner_name: String(form.get('owner_name') ?? ''),
        email: String(form.get('email') ?? ''),
        phone: String(form.get('phone') ?? '') || undefined,
        password: String(form.get('password') ?? ''),
        password_confirmation: String(form.get('password_confirmation') ?? ''),
        plan: planCode,
        vertical,
      });
      setSession(res.token, res.user);
      router.replace('/onboarding');
    } catch (err) {
      if (err instanceof ApiError) {
        const flat: Record<string, string> = {};
        for (const [k, v] of Object.entries(err.errors)) flat[k] = v[0];
        setErrors(flat);
        if (Object.keys(flat).length === 0) setGeneral(err.message);
      } else {
        setGeneral(t('genericError'));
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell>
      <Card>
        <h2 className="text-xl font-bold text-ink">{t('registerTitle')}</h2>
        <p className="mt-1 text-sm text-muted">{t('registerSubtitle')}</p>

        {general && (
          <div className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{general}</div>
        )}

        <form className="mt-6 space-y-5" onSubmit={onSubmit}>
          <Field label={t('businessName')} error={errors.business_name}>
            <Input name="business_name" required autoComplete="organization" />
          </Field>
          <Field label={t('ownerName')} error={errors.owner_name}>
            <Input name="owner_name" required autoComplete="name" />
          </Field>
          <Field label={t('email')} error={errors.email}>
            <Input name="email" type="email" required autoComplete="email" />
          </Field>
          <Field label={t('phone')} error={errors.phone}>
            <Input name="phone" type="tel" autoComplete="tel" />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t('password')} error={errors.password}>
              <Input name="password" type="password" required autoComplete="new-password" />
            </Field>
            <Field label={t('passwordConfirm')}>
              <Input name="password_confirmation" type="password" required autoComplete="new-password" />
            </Field>
          </div>

          {/* Plan picker */}
          <div>
            <span className="mb-1.5 block text-xs font-medium text-muted">Plan</span>
            <div className="grid gap-2 sm:grid-cols-2">
              {plans.map((p) => {
                const price = Number(p.price_monthly);
                return (
                  <button
                    key={p.code}
                    type="button"
                    onClick={() => pickPlan(p.code)}
                    className={`rounded-xl border px-3 py-2.5 text-left transition ${
                      planCode === p.code
                        ? 'border-brand-500 bg-brand-50 ring-2 ring-brand-200'
                        : 'border-line hover:border-brand-300'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold text-ink">{p.name}</span>
                      <span className="text-xs font-medium text-muted">
                        {price > 0 ? `${price} ${p.currency}/ay` : p.code === 'enterprise' ? 'İletişim' : 'Ücretsiz'}
                      </span>
                    </div>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {p.verticals.map((v) => (
                        <span key={v} className="rounded bg-canvas px-1.5 py-0.5 text-[10px] text-muted">
                          {VERTICALS.find((x) => x.value === v)?.icon}{' '}
                          {VERTICALS.find((x) => x.value === v)?.label ?? v}
                        </span>
                      ))}
                    </div>
                  </button>
                );
              })}
            </div>
            {errors.plan && <p className="mt-1 text-xs text-red-600">{errors.plan}</p>}
          </div>

          {/* Vertical picker (gated by plan) */}
          <div>
            <span className="mb-1.5 block text-xs font-medium text-muted">İşletme Türü</span>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {VERTICALS.map((v) => {
                const disabled = !allowed.includes(v.value);
                return (
                  <button
                    key={v.value}
                    type="button"
                    disabled={disabled}
                    onClick={() => setVertical(v.value)}
                    title={disabled ? 'Bu tür seçili planda yok' : undefined}
                    className={`rounded-lg border px-2 py-2 text-center text-xs font-medium transition ${
                      vertical === v.value
                        ? 'border-brand-500 bg-brand-50 text-brand-700 ring-2 ring-brand-200'
                        : disabled
                          ? 'cursor-not-allowed border-line bg-canvas text-muted/40'
                          : 'border-line text-ink hover:border-brand-300'
                    }`}
                  >
                    <span className="block text-base">{v.icon}</span>
                    {v.label}
                    {disabled && <span className="ml-0.5">🔒</span>}
                  </button>
                );
              })}
            </div>
            {errors.vertical && <p className="mt-1 text-xs text-red-600">{errors.vertical}</p>}
          </div>

          <Button type="submit" loading={loading} className="w-full">
            {loading ? t('creating') : t('createAccount')}
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-muted">
          {t('haveAccount')}{' '}
          <Link href="/login" className="font-semibold text-brand-600 hover:underline">
            {t('goLogin')}
          </Link>
        </p>
      </Card>
    </AuthShell>
  );
}
