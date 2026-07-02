'use client';

import { useCallback, useEffect, useState } from 'react';
import { Panel } from '@/components/superadmin-ui';
import { Button, Input } from '@/components/ui';
import { useApi } from '@/lib/useApi';

// Quick-pick palette so the operator can add an icon with one click instead of
// hunting for the OS emoji keyboard. Free typing / paste still works too.
const PALETTE = ['🌾', '🦐', '🥚', '🐟', '🥜', '🫘', '🥛', '🌰', '🥬', '🟡', '🥯', '🍷', '🌼', '🦪', '🧀', '🍤', '🦀', '🍯', '🫒', '🍞'];

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
    <Panel title="Alerjenler" right={<span className="text-xs text-muted">{items.length} kayıt</span>}>
      <form className="mb-2 flex flex-wrap items-end gap-2" onSubmit={add}>
        <div>
          <span className="mb-1 block text-xs text-muted">Kod</span>
          <Input className="w-32" placeholder="sesame" value={code} onChange={(e) => setCode(e.target.value)} required />
        </div>
        <div>
          <span className="mb-1 block text-xs text-muted">Ad</span>
          <Input placeholder="Susam" value={name} onChange={(e) => setName(e.target.value)} required />
        </div>
        <div>
          <span className="mb-1 block text-xs text-muted">Simge (emoji)</span>
          <Input className="w-24 text-center text-lg" placeholder="🌰" value={icon} onChange={(e) => setIcon(e.target.value)} />
        </div>
        <Button type="submit">Ekle</Button>
      </form>

      {/* Emoji quick-pick — answers "simge nasıl eklenecek": bir emojiye tıkla. */}
      <div className="mb-4">
        <p className="mb-1.5 text-xs text-muted">Hızlı seç (bir emojiye tıklayın veya kendiniz yapıştırın):</p>
        <div className="flex flex-wrap gap-1.5">
          {PALETTE.map((e) => (
            <button
              key={e}
              type="button"
              onClick={() => setIcon(e)}
              className={`grid h-9 w-9 place-items-center rounded-lg border text-lg transition ${
                icon === e ? 'border-brand-500 bg-brand-50' : 'border-line bg-white hover:bg-canvas'
              }`}
              aria-label={`Simge ${e}`}
            >
              {e}
            </button>
          ))}
          {icon && (
            <button
              type="button"
              onClick={() => setIcon('')}
              className="grid h-9 place-items-center rounded-lg border border-line bg-white px-2 text-xs text-muted hover:bg-canvas"
            >
              Temizle
            </button>
          )}
        </div>
      </div>

      {error && <p className="mb-2 text-xs text-red-600">{error}</p>}

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((a) => (
          <div key={a.id} className="flex items-center justify-between gap-2 rounded-lg border border-line px-3 py-2">
            <span className="flex min-w-0 items-center gap-2.5">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-canvas text-lg">
                {a.icon || '—'}
              </span>
              <span className="min-w-0 truncate text-sm text-ink">
                {a.name} <span className="text-xs text-muted">({a.code})</span>
              </span>
            </span>
            <button
              onClick={async () => {
                await api.superDeleteAllergen(a.id);
                load();
              }}
              className="shrink-0 text-xs font-medium text-red-600"
            >
              Sil
            </button>
          </div>
        ))}
      </div>
    </Panel>
  );
}
