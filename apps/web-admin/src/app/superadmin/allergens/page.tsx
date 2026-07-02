'use client';

import { useCallback, useEffect, useState } from 'react';
import { Panel } from '@/components/superadmin-ui';
import { Button, Input } from '@/components/ui';
import { useApi } from '@/lib/useApi';

export default function AllergensPage() {
  const { api, ready } = useApi();
  const [items, setItems] = useState<any[]>([]);
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [icon, setIcon] = useState('');
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => setItems(await api.superAllergens()), [api]);
  useEffect(() => {
    if (ready) load();
  }, [ready, load]);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await api.superCreateAllergen({ code: code.trim(), name: name.trim(), icon: icon.trim() || null });
      setCode('');
      setName('');
      setIcon('');
      load();
    } catch {
      setError('Alerjen eklenemedi (kod benzersiz olmalı).');
    }
  }

  return (
    <Panel
      title="Alerjenler"
      right={<span className="text-xs text-muted">{items.length} kayıt</span>}
    >
      <form className="mb-4 flex flex-wrap items-end gap-2" onSubmit={add}>
        <div>
          <span className="mb-1 block text-xs text-muted">Kod</span>
          <Input className="w-32" placeholder="sesame" value={code} onChange={(e) => setCode(e.target.value)} required />
        </div>
        <div>
          <span className="mb-1 block text-xs text-muted">Ad</span>
          <Input placeholder="Susam" value={name} onChange={(e) => setName(e.target.value)} required />
        </div>
        <div>
          <span className="mb-1 block text-xs text-muted">Simge</span>
          <Input className="w-20" placeholder="🌰" value={icon} onChange={(e) => setIcon(e.target.value)} />
        </div>
        <Button type="submit">Ekle</Button>
      </form>
      {error && <p className="mb-2 text-xs text-red-600">{error}</p>}

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((a) => (
          <div key={a.id} className="flex items-center justify-between rounded-lg border border-line px-3 py-2">
            <span className="text-sm text-ink">
              {a.icon ? `${a.icon} ` : ''}
              {a.name} <span className="text-xs text-muted">({a.code})</span>
            </span>
            <button
              onClick={async () => {
                await api.superDeleteAllergen(a.id);
                load();
              }}
              className="text-xs text-red-600"
            >
              Sil
            </button>
          </div>
        ))}
      </div>
    </Panel>
  );
}
