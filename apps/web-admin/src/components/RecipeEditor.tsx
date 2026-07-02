'use client';

import { useCallback, useEffect, useState } from 'react';
import { Button, Input } from './ui';

interface Item {
  ingredient_id: number;
  ingredient_name?: string;
  quantity: number;
  unit: string;
}

/**
 * Recipe editor — the differentiating M2 nutrition engine, exposed in the panel.
 * Pick ingredients + quantities, save, and see auto-computed calories, macros,
 * allergens, diet flags and cost/margin.
 */
export function RecipeEditor({
  product,
  ingredients,
  api,
}: {
  product: any;
  ingredients: any[];
  api: any;
}) {
  const [items, setItems] = useState<Item[]>([]);
  const [yieldPortions, setYieldPortions] = useState(1);
  const [nutrition, setNutrition] = useState<any | null>(null);
  const [saving, setSaving] = useState(false);
  const [ingId, setIngId] = useState('');
  const [qty, setQty] = useState('');

  const loadNutrition = useCallback(async () => {
    try {
      setNutrition(await api.productNutrition(product.id));
    } catch {
      setNutrition(null);
    }
  }, [api, product.id]);

  useEffect(() => {
    api.getRecipe(product.id).then((r: any) => {
      setYieldPortions(r.yield_portions ?? 1);
      setItems(
        (r.items ?? []).map((i: any) => ({
          ingredient_id: i.ingredient_id,
          ingredient_name: i.ingredient_name,
          quantity: Number(i.quantity),
          unit: i.unit,
        })),
      );
    });
    loadNutrition();
  }, [api, product.id, loadNutrition]);

  function addItem() {
    const ing = ingredients.find((x) => x.id === Number(ingId));
    if (!ing || !qty) return;
    setItems((s) => [
      ...s,
      { ingredient_id: ing.id, ingredient_name: ing.name, quantity: Number(qty), unit: ing.unit },
    ]);
    setIngId('');
    setQty('');
  }

  async function save() {
    setSaving(true);
    try {
      await api.putRecipe(product.id, {
        yield_portions: yieldPortions,
        items: items.map((i) => ({ ingredient_id: i.ingredient_id, quantity: i.quantity, unit: i.unit })),
      });
      // Recompute runs on the queue; poll the summary shortly after.
      setTimeout(loadNutrition, 400);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mt-3 rounded-xl border border-line bg-canvas p-4">
      <div className="grid gap-4 lg:grid-cols-2">
        <div>
          <div className="mb-2 flex items-center gap-2 text-sm">
            <span className="text-muted">Porsiyon:</span>
            <Input
              type="number"
              className="w-20"
              value={String(yieldPortions)}
              onChange={(e) => setYieldPortions(Math.max(1, Number(e.target.value)))}
            />
          </div>

          <ul className="mb-2 space-y-1">
            {items.map((it, idx) => (
              <li key={idx} className="flex items-center justify-between rounded-lg bg-white px-3 py-1.5 text-sm">
                <span className="text-ink">
                  {it.ingredient_name ?? `#${it.ingredient_id}`} — {it.quantity} {it.unit}
                </span>
                <button
                  onClick={() => setItems((s) => s.filter((_, i) => i !== idx))}
                  className="text-xs text-red-600"
                >
                  Sil
                </button>
              </li>
            ))}
            {items.length === 0 && <li className="text-xs text-muted">Henüz malzeme yok.</li>}
          </ul>

          <div className="flex gap-2">
            <select
              className="flex-1 rounded-lg border border-line bg-white px-3 py-2 text-sm"
              value={ingId}
              onChange={(e) => setIngId(e.target.value)}
            >
              <option value="">Malzeme seç…</option>
              {ingredients.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.name} ({i.unit})
                </option>
              ))}
            </select>
            <Input placeholder="Miktar" type="number" className="w-24" value={qty} onChange={(e) => setQty(e.target.value)} />
            <Button variant="ghost" type="button" onClick={addItem}>
              Ekle
            </Button>
          </div>

          <div className="mt-3">
            <Button onClick={save} loading={saving}>
              Reçeteyi Kaydet & Hesapla
            </Button>
          </div>
        </div>

        <div className="rounded-xl border border-line bg-white p-4">
          <h4 className="mb-2 text-sm font-semibold text-ink">Besin & Maliyet (otomatik)</h4>
          {nutrition ? (
            <div className="space-y-1.5 text-sm">
              <Row label="Kalori" value={`${nutrition.kcal} kcal`} strong />
              <Row label="Protein / Karb / Yağ" value={`${nutrition.macros.protein_g} / ${nutrition.macros.carb_g} / ${nutrition.macros.fat_g} g`} />
              <Row label="Maliyet / porsiyon" value={`₺${nutrition.cost_per_portion}`} />
              <Row label="Önerilen fiyat" value={nutrition.suggested_price ? `₺${nutrition.suggested_price}` : '—'} />
              <Row label="Marj" value={nutrition.margin_pct != null ? `%${nutrition.margin_pct}` : '—'} />
              <div className="flex flex-wrap gap-1 pt-1">
                {nutrition.diet?.vegan && <Tag>Vegan</Tag>}
                {nutrition.diet?.vegetarian && <Tag>Vejetaryen</Tag>}
                {nutrition.diet?.gluten_free && <Tag>Glutensiz</Tag>}
              </div>
            </div>
          ) : (
            <p className="text-xs text-muted">Reçete kaydedince kalori, makro, alerjen ve maliyet otomatik hesaplanır.</p>
          )}
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex justify-between">
      <span className="text-muted">{label}</span>
      <span className={strong ? 'font-bold text-ink' : 'text-ink'}>{value}</span>
    </div>
  );
}

function Tag({ children }: { children: React.ReactNode }) {
  return <span className="rounded-md bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800">{children}</span>;
}
