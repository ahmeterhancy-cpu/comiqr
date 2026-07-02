'use client';

import { useEffect, useState } from 'react';
import { Panel } from '@/components/superadmin-ui';
import { useApi } from '@/lib/useApi';

export default function TransactionsPage() {
  const { api, ready } = useApi();
  const [rows, setRows] = useState<any[]>([]);

  useEffect(() => {
    if (ready) api.superTransactions().then(setRows).catch(() => setRows([]));
  }, [ready, api]);

  return (
    <Panel title="İşlemler (ödemeler)">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
              <th className="py-2">İşletme</th>
              <th>Kanal</th>
              <th className="text-right">Tutar</th>
              <th className="text-right">Bahşiş</th>
              <th>Durum</th>
              <th className="text-right">Tarih</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-line/60">
                <td className="py-2.5 font-medium text-ink">{r.tenant ?? '—'}</td>
                <td className="text-muted">{r.gateway}</td>
                <td className="text-right text-ink">{Number(r.amount).toFixed(2)}</td>
                <td className="text-right text-muted">{Number(r.tip ?? 0).toFixed(2)}</td>
                <td>
                  <span
                    className={`rounded-md px-2 py-0.5 text-xs font-medium ${
                      r.status === 'paid' ? 'bg-emerald-100 text-emerald-800' : 'bg-canvas text-muted'
                    }`}
                  >
                    {r.status}
                  </span>
                </td>
                <td className="text-right text-xs text-muted">
                  {r.created_at ? new Date(r.created_at).toLocaleString() : ''}
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="py-3 text-sm text-muted">
                  Henüz işlem yok.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}
