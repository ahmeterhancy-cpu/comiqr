'use client';

import { useEffect, useState } from 'react';
import { Panel } from '@/components/superadmin-ui';
import { useApi } from '@/lib/useApi';

export default function AuditPage() {
  const { api, ready } = useApi();
  const [logs, setLogs] = useState<any[]>([]);

  useEffect(() => {
    if (ready) api.superAuditLogs().then(setLogs).catch(() => setLogs([]));
  }, [ready, api]);

  return (
    <Panel title="Denetim Kaydı">
      <ul className="divide-y divide-line text-sm">
        {logs.map((l) => (
          <li key={l.id} className="flex items-center justify-between py-2.5">
            <div>
              <span className="font-medium text-ink">{l.action}</span>
              <span className="ml-2 text-muted">
                {l.tenant ?? ''} {l.user ? `· ${l.user}` : ''}
              </span>
            </div>
            <span className="text-xs text-muted">{l.created_at ? new Date(l.created_at).toLocaleString() : ''}</span>
          </li>
        ))}
        {logs.length === 0 && <li className="py-4 text-muted">Kayıt yok.</li>}
      </ul>
    </Panel>
  );
}
