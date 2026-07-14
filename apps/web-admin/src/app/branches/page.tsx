'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { AdminShell } from '@/components/AdminShell';
import { Button, Card, Field, Input } from '@/components/ui';
import { useApi } from '@/lib/useApi';

export default function BranchesPage() {
  const t = useTranslations('branches');
  const c = useTranslations('common');
  const { api, ready } = useApi();
  const [branches, setBranches] = useState<any[]>([]);
  const [f, setF] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => setBranches(await api.adminBranches()), [api]);

  useEffect(() => {
    if (ready) load();
  }, [ready, load]);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await api.createBranch({ name: f.name, address: f.address, phone: f.phone });
      setF({});
      load();
    } catch {
      setError(t('addError'));
    }
  }

  async function remove(id: number) {
    try {
      await api.deleteBranch(id);
      load();
    } catch {
      setError(t('minOneBranch'));
    }
  }

  return (
    <AdminShell title={t('title')}>
      <Card>
        <form className="grid gap-4 sm:grid-cols-3" onSubmit={add}>
          <Field label={t('branchName')}>
            <Input required value={f.name ?? ''} onChange={(e) => setF((s) => ({ ...s, name: e.target.value }))} />
          </Field>
          <Field label={t('address')}>
            <Input value={f.address ?? ''} onChange={(e) => setF((s) => ({ ...s, address: e.target.value }))} />
          </Field>
          <Field label={t('phone')}>
            <Input value={f.phone ?? ''} onChange={(e) => setF((s) => ({ ...s, phone: e.target.value }))} />
          </Field>
          <div className="sm:col-span-3">
            <Button type="submit">{t('addBranch')}</Button>
            {error && <span className="ml-3 text-xs text-red-600">{error}</span>}
          </div>
        </form>
      </Card>

      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {branches.map((b) => (
          <Card key={b.id}>
            <div className="flex items-start justify-between">
              <div>
                <div className="font-semibold text-ink">{b.name}</div>
                {b.address && <div className="mt-0.5 text-xs text-muted">{b.address}</div>}
                {b.phone && <div className="text-xs text-muted">{b.phone}</div>}
              </div>
              <button onClick={() => remove(b.id)} className="text-xs text-red-600">
                {c('delete')}
              </button>
            </div>
          </Card>
        ))}
      </div>
    </AdminShell>
  );
}
