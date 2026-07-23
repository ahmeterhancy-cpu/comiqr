'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { AdminShell } from '@/components/AdminShell';
import { RestaurantSettingsForm } from '@/components/RestaurantSettingsForm';
import { useApi } from '@/lib/useApi';

export default function SettingsPage() {
  const t = useTranslations('settings');
  const c = useTranslations('common');
  const { api, ready } = useApi();
  const [tenant, setTenant] = useState<any | null>(null);

  useEffect(() => {
    if (ready) api.getTenant().then(setTenant).catch(() => setTenant(null));
  }, [ready, api]);

  return (
    <AdminShell title={t('title')}>
      {tenant ? (
        <RestaurantSettingsForm
          initialName={tenant.name}
          initialSettings={tenant.settings}
          currency={tenant.currency}
          slug={tenant.slug}
          allowedVerticals={tenant.plan?.features?.verticals}
          whiteLabel={!!tenant.plan?.features?.white_label}
          happyHour={!!tenant.plan?.features?.happy_hour}
          onSave={(payload) => api.updateTenant(payload as any)}
          onUpload={(type, file) => api.uploadRestaurantMedia(type, file)}
        />
      ) : (
        <p className="text-sm text-muted">{c('loading')}</p>
      )}
    </AdminShell>
  );
}
