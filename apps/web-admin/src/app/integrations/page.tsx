'use client';

import { useCallback, useEffect, useState } from 'react';
import { AdminShell } from '@/components/AdminShell';
import { Button, Card, Input } from '@/components/ui';
import { useApi } from '@/lib/useApi';

const TYPES = [
  { value: 'pos', label: 'POS (adisyon)' },
  { value: 'okc', label: 'ÖKC (yazarkasa)' },
  { value: 'erp', label: 'ERP' },
  { value: 'delivery', label: 'Teslimat (delivery)' },
];

export default function IntegrationsPage() {
  const { api, ready } = useApi();
  const [items, setItems] = useState<any[]>([]);
  const [type, setType] = useState('pos');
  const [provider, setProvider] = useState('webhook');
  const [name, setName] = useState('');
  const [endpoint, setEndpoint] = useState('');
  const [secret, setSecret] = useState('');
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => setItems(await api.adminIntegrations()), [api]);

  useEffect(() => {
    if (ready) load();
  }, [ready, load]);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await api.createIntegration({
        type,
        provider: provider.trim() || 'webhook',
        name: name.trim(),
        config_json: { endpoint: endpoint.trim() || null, secret: secret.trim() || null },
      });
      setName('');
      setEndpoint('');
      setSecret('');
      load();
    } catch {
      setError('Entegrasyon eklenemedi. Uç nokta geçerli bir URL olmalı.');
    }
  }

  async function test(i: any) {
    setNote(null);
    try {
      const res = await api.testIntegration(i.id);
      setNote(res.ok ? `${i.name}: bağlantı başarılı ✓` : `${i.name}: bağlantı başarısız`);
    } catch {
      setNote(`${i.name}: bağlantı başarısız`);
    }
  }

  async function toggle(i: any) {
    await api.updateIntegration(i.id, { is_active: !i.is_active });
    load();
  }

  return (
    <AdminShell title="Entegrasyonlar">
      <Card>
        <form className="flex flex-wrap items-end gap-2" onSubmit={add}>
          <div>
            <span className="mb-1 block text-xs text-muted">Tür</span>
            <select
              className="rounded-lg border border-line bg-white px-3 py-2.5 text-sm"
              value={type}
              onChange={(e) => setType(e.target.value)}
            >
              {TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <span className="mb-1 block text-xs text-muted">Sağlayıcı</span>
            <Input className="w-36" placeholder="webhook" value={provider} onChange={(e) => setProvider(e.target.value)} />
          </div>
          <div>
            <span className="mb-1 block text-xs text-muted">Ad</span>
            <Input placeholder="Simpra / Yemeksepeti" value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div className="min-w-[220px] flex-1">
            <span className="mb-1 block text-xs text-muted">Uç nokta (webhook URL)</span>
            <Input
              placeholder="https://…/hook"
              value={endpoint}
              onChange={(e) => setEndpoint(e.target.value)}
            />
          </div>
          <div>
            <span className="mb-1 block text-xs text-muted">Gizli anahtar (ops.)</span>
            <Input className="w-40" value={secret} onChange={(e) => setSecret(e.target.value)} />
          </div>
          <Button type="submit">Ekle</Button>
        </form>
        {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
        {note && <p className="mt-2 text-xs text-muted">{note}</p>}
      </Card>

      <div className="mt-6 space-y-3">
        {items.length === 0 && <p className="text-sm text-muted">Henüz entegrasyon yok.</p>}
        {items.map((i) => (
          <Card key={i.id}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-ink">{i.name}</span>
                  <span className="rounded-full bg-canvas px-2 py-0.5 text-xs uppercase text-muted">{i.type}</span>
                  <span className="text-xs text-muted">{i.provider}</span>
                  {i.has_secret && <span className="text-xs text-emerald-700">🔒 imzalı</span>}
                </div>
                <p className="mt-1 truncate text-xs text-muted">{i.endpoint ?? '—'}</p>
                {i.last_synced_at && (
                  <p className="text-xs text-muted">Son senkron: {new Date(i.last_synced_at).toLocaleString()}</p>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <button
                  onClick={() => toggle(i)}
                  className={`rounded-md px-2 py-0.5 text-xs font-medium ${
                    i.is_active ? 'bg-emerald-100 text-emerald-800' : 'bg-canvas text-muted'
                  }`}
                >
                  {i.is_active ? 'Aktif' : 'Pasif'}
                </button>
                <Button type="button" variant="ghost" onClick={() => test(i)}>
                  Test
                </Button>
                <button
                  onClick={async () => {
                    await api.deleteIntegration(i.id);
                    load();
                  }}
                  className="text-xs text-red-600"
                >
                  Sil
                </button>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </AdminShell>
  );
}
