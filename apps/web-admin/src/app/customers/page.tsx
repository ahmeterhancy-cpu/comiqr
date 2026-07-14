'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { AdminShell } from '@/components/AdminShell';
import { Card } from '@/components/ui';
import { useApi } from '@/lib/useApi';

export default function CustomersPage() {
  const t = useTranslations('customers');
  const c = useTranslations('common');
  const { api, ready } = useApi();
  const [customers, setCustomers] = useState<any[]>([]);

  useEffect(() => {
    if (ready) api.adminCustomers().then(setCustomers);
  }, [ready, api]);

  return (
    <AdminShell title={t('title')}>
      <Card>
        {customers.length === 0 ? (
          <p className="text-sm text-muted">
            {t('empty')}
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
                <th className="py-2">{c('name')}</th>
                <th>{t('phone')}</th>
                <th className="text-right">{t('orders')}</th>
                <th className="text-right">{t('spend')}</th>
                <th className="text-right">{t('points')}</th>
                <th>{t('tier')}</th>
              </tr>
            </thead>
            <tbody>
              {customers.map((c) => (
                <tr key={c.id} className="border-b border-line/60">
                  <td className="py-2 font-medium text-ink">{c.name ?? '—'}</td>
                  <td className="font-mono text-xs text-muted">{c.phone_masked ?? '—'}</td>
                  <td className="text-right">{c.total_orders}</td>
                  <td className="text-right text-muted">₺{Number(c.total_spend).toFixed(0)}</td>
                  <td className="text-right font-semibold text-brand-600">{c.points}</td>
                  <td className="text-xs text-muted">{c.tier}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </AdminShell>
  );
}
