'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Panel } from '@/components/superadmin-ui';
import { RestaurantSettingsForm } from '@/components/RestaurantSettingsForm';
import { useApi } from '@/lib/useApi';

export default function ManageRestaurantPage() {
  const { api, ready } = useApi();
  const params = useParams();
  const id = Number(params.id);
  const [detail, setDetail] = useState<any | null>(null);

  useEffect(() => {
    if (ready && id) api.superTenantDetail(id).then(setDetail).catch(() => setDetail(null));
  }, [ready, api, id]);

  return (
    <div className="space-y-4">
      <Link href="/superadmin/restaurants" className="text-sm text-brand-600">
        ← İşletmeler
      </Link>
      {detail ? (
        <Panel title={`Restoran Yönet — ${detail.name}`}>
          <RestaurantSettingsForm
            initialName={detail.name}
            initialSettings={detail.settings}
            currency={detail.currency}
            slug={detail.slug}
            onSave={(payload) => api.superUpdateRestaurant(id, payload)}
          />
        </Panel>
      ) : (
        <p className="text-sm text-muted">Yükleniyor…</p>
      )}
    </div>
  );
}
