'use client';

import { useEffect, useState } from 'react';
import { AdminShell } from '@/components/AdminShell';
import { RestaurantSettingsForm } from '@/components/RestaurantSettingsForm';
import { useApi } from '@/lib/useApi';

export default function SettingsPage() {
  const { api, ready } = useApi();
  const [tenant, setTenant] = useState<any | null>(null);

  useEffect(() => {
    if (ready) api.getTenant().then(setTenant).catch(() => setTenant(null));
  }, [ready, api]);

  return (
    <AdminShell title="Restoran Ayarları">
      {tenant ? (
        <RestaurantSettingsForm
          initialName={tenant.name}
          initialSettings={tenant.settings}
          currency={tenant.currency}
          slug={tenant.slug}
          onSave={(payload) => api.updateTenant(payload as any)}
          onUpload={(type, file) => api.uploadRestaurantMedia(type, file)}
        />
      ) : (
        <p className="text-sm text-muted">Yükleniyor…</p>
      )}
    </AdminShell>
  );
}
