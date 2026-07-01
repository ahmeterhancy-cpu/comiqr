'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { ApiError } from '@comiqr/shared-types/client';
import { AuthShell } from '@/components/AuthShell';
import { Button, Card, Field, Input } from '@/components/ui';
import { createApi } from '@/lib/api';
import { setSession } from '@/lib/auth';

export default function RegisterPage() {
  const t = useTranslations('auth');
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [general, setGeneral] = useState<string | null>(null);

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
      });
      setSession(res.token, res.user);
      router.replace('/dashboard');
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

        <form className="mt-6 space-y-4" onSubmit={onSubmit}>
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
