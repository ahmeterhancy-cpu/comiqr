'use client';

import { useCallback, useEffect, useState } from 'react';
import { AdminShell } from '@/components/AdminShell';
import { Button, Card, Input } from '@/components/ui';
import { useApi } from '@/lib/useApi';

export default function MenuPage() {
  const { api, ready } = useApi();
  const [categories, setCategories] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const [cats, prods] = await Promise.all([api.adminCategories(), api.adminProducts()]);
    setCategories(cats);
    setProducts(prods);
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

      <div className="mt-6 space-y-6">
        {categories.length === 0 && (
          <Card>
            <p className="text-sm text-muted">Henüz kategori yok. Yukarıdan ilk kategorinizi ekleyin.</p>
          </Card>
        )}
        {categories.map((c) => (
          <Card key={c.id}>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-bold uppercase tracking-wide text-brand-600">{c.name}</h2>
            </div>
            <ul className="divide-y divide-line">
              {products
                .filter((p) => p.category_id === c.id)
                .map((p) => (
                  <li key={p.id} className="flex items-center justify-between gap-3 py-2.5">
                    <div className="min-w-0">
                      <span className="font-medium text-ink">{p.name}</span>
                      {p.nutrition && (
                        <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-xs font-semibold text-amber-800">
                          {Math.round(p.nutrition.kcal)} kcal
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-semibold text-ink">₺{Number(p.price).toFixed(0)}</span>
                      <button
                        onClick={() => toggleProduct(p)}
                        className={`rounded-md px-2 py-0.5 text-xs font-medium ${
                          p.is_active ? 'bg-emerald-100 text-emerald-800' : 'bg-canvas text-muted'
                        }`}
                      >
                        {p.is_active ? 'Aktif' : 'Pasif'}
                      </button>
                    </div>
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
      <Input
        placeholder="₺"
        type="number"
        className="w-24"
        value={price}
        onChange={(e) => setPrice(e.target.value)}
      />
      <Button type="submit" variant="ghost">
        Ürün Ekle
      </Button>
    </form>
  );
}
