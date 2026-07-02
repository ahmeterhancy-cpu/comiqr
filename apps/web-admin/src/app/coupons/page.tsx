'use client';

import { useCallback, useEffect, useState } from 'react';
import { AdminShell } from '@/components/AdminShell';
import { Button, Card, Input } from '@/components/ui';
import { useApi } from '@/lib/useApi';

export default function CouponsPage() {
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
      setError('Kupon oluşturulamadı (kod benzersiz olmalı).');
    }
  }

  return (
    <AdminShell title="Kuponlar">
      <Card>
        <form className="flex flex-wrap items-end gap-2" onSubmit={add}>
          <div>
            <span className="mb-1 block text-xs text-muted">Kod</span>
            <Input placeholder="INDIRIM20" value={code} onChange={(e) => setCode(e.target.value)} required />
          </div>
          <div>
            <span className="mb-1 block text-xs text-muted">Tip</span>
            <select
              className="rounded-lg border border-line bg-white px-3 py-2.5 text-sm"
              value={type}
              onChange={(e) => setType(e.target.value)}
            >
              <option value="percent">Yüzde (%)</option>
              <option value="amount">Tutar (₺)</option>
            </select>
          </div>
          <div>
            <span className="mb-1 block text-xs text-muted">Değer</span>
            <Input type="number" className="w-28" value={value} onChange={(e) => setValue(e.target.value)} required />
          </div>
          <Button type="submit">Kupon Ekle</Button>
        </form>
        {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
      </Card>

      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {coupons.map((c) => (
          <Card key={c.id}>
            <div className="flex items-center justify-between">
              <span className="font-mono font-bold text-ink">{c.code}</span>
              <button onClick={async () => { await api.deleteCoupon(c.id); load(); }} className="text-xs text-red-600">
                Sil
              </button>
            </div>
            <p className="mt-1 text-sm text-muted">
              {c.type === 'percent' ? `%${c.value} indirim` : `₺${c.value} indirim`} · kullanım: {c.used_count}
            </p>
          </Card>
        ))}
      </div>
    </AdminShell>
  );
}
