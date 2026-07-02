'use client';

import { useEffect, useState } from 'react';
import { Panel } from '@/components/superadmin-ui';
import { Input } from '@/components/ui';
import { useApi } from '@/lib/useApi';

export default function UsersPage() {
  const { api, ready } = useApi();
  const [q, setQ] = useState('');
  const [results, setResults] = useState<any[]>([]);

  useEffect(() => {
    if (!ready) return;
    if (q.trim().length < 2) {
      setResults([]);
      return;
    }
    let active = true;
    const id = setTimeout(async () => {
      try {
        const r = await api.superUsers(q.trim());
        if (active) setResults(r);
      } catch {
        if (active) setResults([]);
      }
    }, 250);
    return () => {
      active = false;
      clearTimeout(id);
    };
  }, [q, api, ready]);

  return (
    <Panel title="Kullanıcı arama">
      <Input placeholder="E-posta veya isimle kullanıcı ara…" value={q} onChange={(e) => setQ(e.target.value)} />
      <ul className="mt-3 divide-y divide-line text-sm">
        {results.map((u) => (
          <li key={u.id} className="flex items-center justify-between py-2">
            <div>
              <span className="font-medium text-ink">{u.name}</span> <span className="text-muted">· {u.email}</span>
              <div className="text-xs text-muted">
                {u.tenant ?? '— (superadmin)'} · {u.role}
              </div>
            </div>
            <span className="text-xs text-muted">
              {u.last_login_at ? new Date(u.last_login_at).toLocaleDateString() : ''}
            </span>
          </li>
        ))}
        {q.trim().length >= 2 && results.length === 0 && <li className="py-3 text-muted">Sonuç yok.</li>}
        {q.trim().length < 2 && <li className="py-3 text-muted">Aramak için en az 2 karakter girin.</li>}
      </ul>
    </Panel>
  );
}
