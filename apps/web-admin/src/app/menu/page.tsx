'use client';

import { useCallback, useEffect, useState } from 'react';
import { AdminShell } from '@/components/AdminShell';
import { RecipeEditor } from '@/components/RecipeEditor';
import { Button, Card, Input } from '@/components/ui';
import { useApi } from '@/lib/useApi';

export default function MenuPage() {
  const { api, ready } = useApi();
  const [categories, setCategories] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [ingredients, setIngredients] = useState<any[]>([]);
  const [modifierGroups, setModifierGroups] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [busy, setBusy] = useState<number | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [cats, prods, ings, mods] = await Promise.all([
      api.adminCategories(),
      api.adminProducts(),
      api.adminIngredients(),
      api.adminModifierGroups(),
    ]);
    setCategories(cats);
    setProducts(prods);
    setIngredients(ings);
    setModifierGroups(mods);
    setLoading(false);
  }, [api]);

  useEffect(() => {
    if (ready) load();
  }, [ready, load]);

  async function addCategory(name: string) {
    await api.createCategory({ name });
    load();
  }
  async function addProduct(categoryId: number, name: string, price: number) {
    await api.createProduct({ category_id: categoryId, name, price });
    load();
  }
  async function toggleProduct(p: any) {
    await api.updateProduct(p.id, { is_active: !p.is_active });
    load();
  }
  async function toggleAge(p: any) {
    await api.updateProduct(p.id, { age_restricted: !p.age_restricted });
    load();
  }
  async function uploadImage(p: any, file: File) {
    setBusy(p.id);
    try {
      await api.uploadProductImage(p.id, file);
      load();
    } catch {
      setNotice('Görsel yüklenemedi.');
    } finally {
      setBusy(null);
    }
  }

  async function aiCopy(p: any) {
    setBusy(p.id);
    setNotice(null);
    try {
      const res = await api.aiProductCopy(p.id, true);
      setNotice(`AI açıklama üretildi: "${res.description}"`);
      load();
    } catch {
      setNotice('AI bu planda kapalı veya yapılandırılmamış (ANTHROPIC_API_KEY).');
    } finally {
      setBusy(null);
    }
  }

  if (!ready || loading) {
    return (
      <AdminShell title="Menü">
        <p className="text-sm text-muted">Yükleniyor…</p>
      </AdminShell>
    );
  }

  return (
    <AdminShell title="Menü Yönetimi">
      <AddCategory onAdd={addCategory} />
      {notice && (
        <div className="mt-4 rounded-lg bg-brand-50 px-3 py-2 text-sm text-brand-700">{notice}</div>
      )}

      <div className="mt-6 space-y-6">
        {categories.map((c) => (
          <Card key={c.id}>
            <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-brand-600">{c.name}</h2>
            <ul className="divide-y divide-line">
              {products
                .filter((p) => p.category_id === c.id)
                .map((p) => (
                  <li key={p.id} className="py-2.5">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-3">
                        {p.images?.[0] ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={p.images[0]} alt={p.name} className="h-10 w-10 rounded-lg object-cover" />
                        ) : (
                          <span className="grid h-10 w-10 place-items-center rounded-lg bg-canvas text-xs text-muted">—</span>
                        )}
                        <div className="min-w-0">
                          <span className="font-medium text-ink">{p.name}</span>
                          {p.nutrition && (
                            <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-xs font-semibold text-amber-800">
                              {Math.round(p.nutrition.kcal)} kcal
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <label className="cursor-pointer rounded-md border border-line px-2 py-0.5 text-xs font-medium text-muted">
                          Görsel
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(e) => e.target.files?.[0] && uploadImage(p, e.target.files[0])}
                          />
                        </label>
                        <span className="text-sm font-semibold text-ink">₺{Number(p.price).toFixed(0)}</span>
                        <button
                          onClick={() => toggleProduct(p)}
                          className={`rounded-md px-2 py-0.5 text-xs font-medium ${
                            p.is_active ? 'bg-emerald-100 text-emerald-800' : 'bg-canvas text-muted'
                          }`}
                        >
                          {p.is_active ? 'Aktif' : 'Pasif'}
                        </button>
                        <button
                          onClick={() => toggleAge(p)}
                          title="18+ (alkol) — bar yaş sınırı"
                          className={`rounded-md px-2 py-0.5 text-xs font-medium ${
                            p.age_restricted ? 'bg-red-100 text-red-700' : 'bg-canvas text-muted'
                          }`}
                        >
                          18+
                        </button>
                        <button
                          onClick={() => setExpanded(expanded === p.id ? null : p.id)}
                          className="rounded-md border border-brand-500 px-2 py-0.5 text-xs font-semibold text-brand-600"
                        >
                          Reçete & Besin
                        </button>
                        <button
                          onClick={() => aiCopy(p)}
                          disabled={busy === p.id}
                          className="rounded-md border border-line px-2 py-0.5 text-xs font-medium text-muted disabled:opacity-50"
                        >
                          {busy === p.id ? '…' : 'AI açıklama'}
                        </button>
                      </div>
                    </div>
                    {expanded === p.id && (
                      <>
                        <VariantsManager product={p} api={api} onChanged={load} />
                        <ModifiersManager product={p} api={api} groups={modifierGroups} onChanged={load} />
                        <RecipeEditor product={p} ingredients={ingredients} api={api} />
                      </>
                    )}
                  </li>
                ))}
            </ul>
            <AddProduct categoryId={c.id} onAdd={addProduct} />
          </Card>
        ))}
      </div>
    </AdminShell>
  );
}

function AddCategory({ onAdd }: { onAdd: (name: string) => void }) {
  const [name, setName] = useState('');
  return (
    <Card>
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (name.trim()) {
            onAdd(name.trim());
            setName('');
          }
        }}
      >
        <Input placeholder="Yeni kategori adı" value={name} onChange={(e) => setName(e.target.value)} />
        <Button type="submit">Kategori Ekle</Button>
      </form>
    </Card>
  );
}

function VariantsManager({ product, api, onChanged }: { product: any; api: any; onChanged: () => void }) {
  const [name, setName] = useState('');
  const [delta, setDelta] = useState('');
  const variants = product.variants ?? [];

  return (
    <div className="mt-3 rounded-xl border border-line bg-canvas p-4">
      <h4 className="mb-2 text-sm font-semibold text-ink">Varyasyonlar (boy/porsiyon)</h4>
      <div className="mb-2 flex flex-wrap gap-2">
        {variants.map((v: any) => (
          <span key={v.id} className="flex items-center gap-2 rounded-full bg-white px-3 py-1 text-xs">
            {v.name} {Number(v.price_delta) ? `(+₺${Number(v.price_delta).toFixed(0)})` : ''}
            <button
              onClick={async () => { await api.deleteVariant(product.id, v.id); onChanged(); }}
              className="text-red-600"
            >
              ×
            </button>
          </span>
        ))}
        {variants.length === 0 && <span className="text-xs text-muted">Varyasyon yok.</span>}
      </div>
      <form
        className="flex gap-2"
        onSubmit={async (e) => {
          e.preventDefault();
          if (!name.trim()) return;
          await api.addVariant(product.id, { name: name.trim(), price_delta: Number(delta || 0) });
          setName('');
          setDelta('');
          onChanged();
        }}
      >
        <Input placeholder="Ad (ör. Büyük)" value={name} onChange={(e) => setName(e.target.value)} />
        <Input placeholder="+₺" type="number" className="w-24" value={delta} onChange={(e) => setDelta(e.target.value)} />
        <Button type="submit" variant="ghost">Ekle</Button>
      </form>
    </div>
  );
}

function ModifiersManager({
  product,
  api,
  groups,
  onChanged,
}: {
  product: any;
  api: any;
  groups: any[];
  onChanged: () => void;
}) {
  const attachedIds: number[] = (product.modifier_groups ?? []).map((g: any) => g.id);
  const attached = groups.filter((g) => attachedIds.includes(g.id));
  const available = groups.filter((g) => !attachedIds.includes(g.id));

  const [attachId, setAttachId] = useState('');
  const [newName, setNewName] = useState('');
  const [minSel, setMinSel] = useState('0');
  const [maxSel, setMaxSel] = useState('1');
  const [required, setRequired] = useState(false);

  async function createAndAttach() {
    if (!newName.trim()) return;
    const g = await api.createModifierGroup({
      name: newName.trim(),
      min_select: Number(minSel || 0),
      max_select: Math.max(1, Number(maxSel || 1)),
      is_required: required,
    });
    await api.attachModifierGroup(product.id, g.id);
    setNewName('');
    setMinSel('0');
    setMaxSel('1');
    setRequired(false);
    onChanged();
  }

  return (
    <div className="mt-3 rounded-xl border border-line bg-canvas p-4">
      <h4 className="mb-2 text-sm font-semibold text-ink">Ekstra / Seçenek Grupları</h4>

      {attached.length === 0 && <p className="mb-2 text-xs text-muted">Bu ürüne bağlı grup yok.</p>}

      <div className="space-y-3">
        {attached.map((g) => (
          <div key={g.id} className="rounded-lg border border-line bg-white p-3">
            <div className="mb-1.5 flex items-center justify-between gap-2">
              <span className="text-sm font-medium text-ink">
                {g.name}{' '}
                <span className="text-xs font-normal text-muted">
                  ({g.is_required ? 'zorunlu' : 'opsiyonel'} · {g.min_select}–{g.max_select})
                </span>
              </span>
              <button
                onClick={async () => {
                  await api.detachModifierGroup(product.id, g.id);
                  onChanged();
                }}
                className="text-xs font-medium text-red-600"
              >
                Üründen çıkar
              </button>
            </div>
            <div className="mb-2 flex flex-wrap gap-1.5">
              {(g.modifiers ?? []).map((m: any) => (
                <span key={m.id} className="flex items-center gap-1.5 rounded-full bg-canvas px-2.5 py-0.5 text-xs">
                  {m.name}
                  {Number(m.price_delta) ? ` (+₺${Number(m.price_delta).toFixed(0)})` : ''}
                  <button
                    onClick={async () => {
                      await api.deleteModifier(g.id, m.id);
                      onChanged();
                    }}
                    className="text-red-600"
                  >
                    ×
                  </button>
                </span>
              ))}
              {(g.modifiers ?? []).length === 0 && <span className="text-xs text-muted">Seçenek yok.</span>}
            </div>
            <AddOption groupId={g.id} api={api} onChanged={onChanged} />
          </div>
        ))}
      </div>

      {available.length > 0 && (
        <div className="mt-3 flex gap-2">
          <select
            value={attachId}
            onChange={(e) => setAttachId(e.target.value)}
            className="flex-1 rounded-lg border border-line bg-white px-2 py-1.5 text-sm"
          >
            <option value="">Mevcut grubu bağla…</option>
            {available.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>
          <Button
            type="button"
            variant="ghost"
            onClick={async () => {
              if (!attachId) return;
              await api.attachModifierGroup(product.id, Number(attachId));
              setAttachId('');
              onChanged();
            }}
          >
            Bağla
          </Button>
        </div>
      )}

      <div className="mt-3 border-t border-line pt-3">
        <p className="mb-1.5 text-xs font-medium text-muted">Yeni grup oluştur ve bağla</p>
        <div className="flex flex-wrap items-center gap-2">
          <Input
            placeholder="Grup adı (ör. Ekstra Malzeme)"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            className="min-w-[180px] flex-1"
          />
          <label className="flex items-center gap-1 text-xs text-muted">
            min
            <Input type="number" className="w-14" value={minSel} onChange={(e) => setMinSel(e.target.value)} />
          </label>
          <label className="flex items-center gap-1 text-xs text-muted">
            maks
            <Input type="number" className="w-14" value={maxSel} onChange={(e) => setMaxSel(e.target.value)} />
          </label>
          <label className="flex items-center gap-1.5 text-xs text-muted">
            <input type="checkbox" checked={required} onChange={(e) => setRequired(e.target.checked)} />
            Zorunlu
          </label>
          <Button type="button" variant="ghost" onClick={createAndAttach}>
            Oluştur
          </Button>
        </div>
      </div>
    </div>
  );
}

function AddOption({ groupId, api, onChanged }: { groupId: number; api: any; onChanged: () => void }) {
  const [name, setName] = useState('');
  const [delta, setDelta] = useState('');
  return (
    <form
      className="flex gap-2"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!name.trim()) return;
        await api.addModifier(groupId, { name: name.trim(), price_delta: Number(delta || 0) });
        setName('');
        setDelta('');
        onChanged();
      }}
    >
      <Input placeholder="Seçenek (ör. Ekstra Peynir)" value={name} onChange={(e) => setName(e.target.value)} />
      <Input placeholder="+₺" type="number" className="w-24" value={delta} onChange={(e) => setDelta(e.target.value)} />
      <Button type="submit" variant="ghost">
        Ekle
      </Button>
    </form>
  );
}

function AddProduct({ categoryId, onAdd }: { categoryId: number; onAdd: (c: number, n: string, p: number) => void }) {
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  return (
    <form
      className="mt-3 flex gap-2 border-t border-line pt-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (name.trim() && price) {
          onAdd(categoryId, name.trim(), Number(price));
          setName('');
          setPrice('');
        }
      }}
    >
      <Input placeholder="Ürün adı" value={name} onChange={(e) => setName(e.target.value)} />
      <Input placeholder="₺" type="number" className="w-24" value={price} onChange={(e) => setPrice(e.target.value)} />
      <Button type="submit" variant="ghost">
        Ürün Ekle
      </Button>
    </form>
  );
}
