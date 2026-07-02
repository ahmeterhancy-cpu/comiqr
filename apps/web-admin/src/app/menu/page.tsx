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
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [busy, setBusy] = useState<number | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [cats, prods, ings] = await Promise.all([
      api.adminCategories(),
      api.adminProducts(),
      api.adminIngredients(),
    ]);
    setCategories(cats);
    setProducts(prods);
    setIngredients(ings);
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
