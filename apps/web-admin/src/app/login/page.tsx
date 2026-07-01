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

export default function LoginPage() {
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
      const res = await createApi().login({
        email: String(form.get('email') ?? ''),
        password: String(form.get('password') ?? ''),
        device_name: 'web-admin',
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
        <h2 className="text-xl font-bold text-ink">{t('loginTitle')}</h2>
        <p className="mt-1 text-sm text-muted">{t('loginSubtitle')}</p>

        {general && (
          <div className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{general}</div>
        )}

        <form className="mt-6 space-y-4" onSubmit={onSubmit}>
          <Field label={t('email')} error={errors.email}>
            <Input name="email" type="email" required autoComplete="email" />
          </Field>
          <Field label={t('password')}>
            <Input name="password" type="password" required autoComplete="current-password" />
          </Field>

          <Button type="submit" loading={loading} className="w-full">
            {loading ? t('signingIn') : t('signIn')}
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-muted">
          {t('noAccount')}{' '}
          <Link href="/register" className="font-semibold text-brand-600 hover:underline">
            {t('goRegister')}
          </Link>
        </p>
      </Card>
    </AuthShell>
  );
}
