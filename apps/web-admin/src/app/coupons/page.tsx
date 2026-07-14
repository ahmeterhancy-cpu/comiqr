'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { AdminShell } from '@/components/AdminShell';
import { Button, Card, Input } from '@/components/ui';
import { useApi } from '@/lib/useApi';

export default function CouponsPage() {
  const t = useTranslations('coupons');
  const c = useTranslations('common');
  const { api, ready } = useApi();
  const [coupons, setCoupons] = useState<any[]>([]);
  const [code, setCode] = useState('');
  const [type, setType] = useState('percent');
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => setCoupons(await api.adminCoupons()), [api]);

  useEffect(() => {
    if (ready) load();
  }, [ready, load]);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await api.createCoupon({ code: code.trim().toUpperCase(), type, value: Number(value) });
      setCode('');
      setValue('');
      load();
    } catch {
      setError(t('createError'));
    }
  }

  return (
    <AdminShell title={t('title')}>
      <Card>
        <form className="flex flex-wrap items-end gap-2" onSubmit={add}>
          <div>
            <span className="mb-1 block text-xs text-muted">{t('code')}</span>
            <Input placeholder={t('codePlaceholder')} value={code} onChange={(e) => setCode(e.target.value)} required />
          </div>
          <div>
            <span className="mb-1 block text-xs text-muted">{t('type')}</span>
            <select
              className="rounded-lg border border-line bg-white px-3 py-2.5 text-sm"
              value={type}
              onChange={(e) => setType(e.target.value)}
            >
              <option value="percent">{t('typePercent')}</option>
              <option value="amount">{t('typeAmount')}</option>
            </select>
          </div>
          <div>
            <span className="mb-1 block text-xs text-muted">{t('value')}</span>
            <Input type="number" className="w-28" value={value} onChange={(e) => setValue(e.target.value)} required />
          </div>
          <Button type="submit">{t('addCoupon')}</Button>
        </form>
        {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
      </Card>

      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {coupons.map((cp) => (
          <Card key={cp.id}>
            <div className="flex items-center justify-between">
              <span className="font-mono font-bold text-ink">{cp.code}</span>
              <button onClick={async () => { await api.deleteCoupon(cp.id); load(); }} className="text-xs text-red-600">
                {c('delete')}
              </button>
            </div>
            <p className="mt-1 text-sm text-muted">
              {cp.type === 'percent' ? t('discountPercent', { value: cp.value }) : t('discountAmount', { value: cp.value })} · {t('usageCount', { count: cp.used_count })}
            </p>
          </Card>
        ))}
      </div>
    </AdminShell>
  );
}
