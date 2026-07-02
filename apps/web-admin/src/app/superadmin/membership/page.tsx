'use client';

import { useCallback, useEffect, useState } from 'react';
import { Panel } from '@/components/superadmin-ui';
import { Input } from '@/components/ui';
import { useApi } from '@/lib/useApi';

export default function MembershipPage() {
  const { api, ready } = useApi();
  const [plans, setPlans] = useState<any[]>([]);
  const load = useCallback(async () => setPlans(await api.superPlans()), [api]);
  useEffect(() => {
    if (ready) load();
  }, [ready, load]);

  return (
    <Panel title="Üyelik Planları">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
              <th className="py-2">Plan</th>
              <th className="text-right">Aylık</th>
              <th className="text-right">Yıllık</th>
              <th className="text-right">İşletme</th>
              <th className="text-right">Durum</th>
            </tr>
          </thead>
          <tbody>
            {plans.map((p) => (
              <PlanRow key={p.id} p={p} api={api} onChanged={load} />
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}

function PlanRow({ p, api, onChanged }: { p: any; api: any; onChanged: () => void }) {
  const [m, setM] = useState(String(p.price_monthly));
  const [y, setY] = useState(String(p.price_yearly));
  const dirty = m !== String(p.price_monthly) || y !== String(p.price_yearly);
  return (
    <tr className="border-b border-line/60">
      <td className="py-2.5">
        <div className="font-medium text-ink">{p.name}</div>
        <div className="text-xs text-muted">
          {p.code} · {p.currency}
        </div>
      </td>
      <td className="text-right">
        <Input type="number" className="w-24 text-right" value={m} onChange={(e) => setM(e.target.value)} />
      </td>
      <td className="text-right">
        <Input type="number" className="w-24 text-right" value={y} onChange={(e) => setY(e.target.value)} />
      </td>
      <td className="text-right text-muted">{p.tenants}</td>
      <td className="py-2.5 text-right">
        <div className="flex items-center justify-end gap-2">
          {dirty && (
            <button
              onClick={async () => {
                await api.superUpdatePlan(p.id, { price_monthly: Number(m), price_yearly: Number(y) });
                onChanged();
              }}
              className="text-xs font-semibold text-brand-600"
            >
              Kaydet
            </button>
          )}
          <button
            onClick={async () => {
              await api.superUpdatePlan(p.id, { is_active: !p.is_active });
              onChanged();
            }}
            className={`rounded-md px-2 py-0.5 text-xs font-medium ${
              p.is_active ? 'bg-emerald-100 text-emerald-800' : 'bg-canvas text-muted'
            }`}
          >
            {p.is_active ? 'Aktif' : 'Pasif'}
          </button>
        </div>
      </td>
    </tr>
  );
}
