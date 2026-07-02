'use client';

import { useCallback, useEffect, useState } from 'react';
import { AdminShell } from '@/components/AdminShell';
import { Button, Card, Input } from '@/components/ui';
import { useApi } from '@/lib/useApi';

const CUSTOMER_BASE = process.env.NEXT_PUBLIC_CUSTOMER_URL ?? 'http://localhost:3010';

export default function TablesPage() {
  const { api, ready } = useApi();
  const [tables, setTables] = useState<any[]>([]);
  const [code, setCode] = useState('');

  const load = useCallback(async () => setTables(await api.adminTables()), [api]);

  useEffect(() => {
    if (ready) load();
  }, [ready, load]);

  return (
    <AdminShell title="Masalar & QR">
      <Card>
        <form
          className="flex gap-2"
          onSubmit={async (e) => {
            e.preventDefault();
            if (code.trim()) {
              await api.createTable({ code: code.trim() });
              setCode('');
              load();
            }
          }}
        >
          <Input placeholder="Masa kodu (ör. Masa 5)" value={code} onChange={(e) => setCode(e.target.value)} />
          <Button type="submit">Masa Ekle</Button>
          <Button
            type="button"
            variant="ghost"
            onClick={async () => {
              await api.bulkTables({ count: 5, prefix: 'Masa' });
              load();
            }}
          >
            5 Masa Üret
          </Button>
        </form>
      </Card>

      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {tables.map((t) => (
          <Card key={t.id}>
            <div className="flex items-center justify-between">
              <span className="font-semibold text-ink">{t.code}</span>
              <span className={`text-xs ${t.is_active ? 'text-emerald-700' : 'text-muted'}`}>
                {t.is_active ? 'Aktif' : 'Pasif'}
              </span>
            </div>
            <a
              href={`${CUSTOMER_BASE}${t.menu_path}`}
              target="_blank"
              rel="noreferrer"
              className="mt-2 block break-all text-xs text-brand-600 hover:underline"
            >
              {CUSTOMER_BASE}
              {t.menu_path}
            </a>
          </Card>
        ))}
      </div>
    </AdminShell>
  );
}
