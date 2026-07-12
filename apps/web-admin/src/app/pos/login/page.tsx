'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ApiError } from '@comiqr/shared-types/client';
import { Button, Field, Input } from '@/components/ui';
import { createApi } from '@/lib/api';
import { setSession } from '@/lib/auth';

/**
 * Dedicated POS terminal login — separate from the panel login. Any staff with
 * POS access (cashier, waiter+, owner) signs in here and lands straight on the
 * full-screen /pos terminal, never the admin panel.
 */
export default function PosLoginPage() {
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
        device_name: 'pos-terminal',
      });
      setSession(res.token, res.user);
      router.replace('/pos');
    } catch (err) {
      if (err instanceof ApiError) {
        const flat: Record<string, string> = {};
        for (const [k, v] of Object.entries(err.errors)) flat[k] = v[0];
        setErrors(flat);
        if (Object.keys(flat).length === 0) setGeneral(err.message);
      } else {
        setGeneral('Giriş yapılamadı. Lütfen tekrar deneyin.');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid min-h-screen place-items-center bg-slate-900 px-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-2xl">
        <div className="mb-6 flex flex-col items-center gap-2 text-center">
          <span className="grid h-12 w-12 place-items-center rounded-2xl bg-brand-500 text-sm font-extrabold text-white shadow-sm">
            POS
          </span>
          <h1 className="text-lg font-bold text-ink">Kasa Girişi</h1>
          <p className="text-xs text-muted">POS terminaline personel hesabınızla giriş yapın.</p>
        </div>

        {general && <div className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{general}</div>}

        <form className="space-y-4" onSubmit={onSubmit}>
          <Field label="E-posta" error={errors.email}>
            <Input name="email" type="email" required autoComplete="username" />
          </Field>
          <Field label="Şifre">
            <Input name="password" type="password" required autoComplete="current-password" />
          </Field>
          <Button type="submit" loading={loading} className="w-full">
            {loading ? 'Giriş yapılıyor…' : 'Kasaya Gir'}
          </Button>
        </form>
      </div>
    </div>
  );
}
