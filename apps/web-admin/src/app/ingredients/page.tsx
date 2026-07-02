'use client';

import { useCallback, useEffect, useState } from 'react';
import { AdminShell } from '@/components/AdminShell';
import { Button, Card, Field, Input } from '@/components/ui';
import { useApi } from '@/lib/useApi';

export default function IngredientsPage() {
  const { api, ready } = useApi();
  const [ingredients, setIngredients] = useState<any[]>([]);
  const [allergens, setAllergens] = useState<any[]>([]);
  const [open, setOpen] = useState(false);

  const load = useCallback(async () => {
    const [ings, algs] = await Promise.all([api.adminIngredients(), api.adminAllergens()]);
    setIngredients(ings);
    setAllergens(algs);
  }, [api]);

  useEffect(() => {
    if (ready) load();
  }, [ready, load]);

  return (
    <AdminShell title="Malzemeler">
      <div className="mb-4">
        <Button onClick={() => setOpen((v) => !v)}>{open ? 'Kapat' : '+ Malzeme Ekle'}</Button>
      </div>

      {open && <NewIngredient allergens={allergens} onDone={() => { setOpen(false); load(); }} api={api} />}

      <Card className="mt-4">
        {ingredients.length === 0 ? (
          <p className="text-sm text-muted">Henüz malzeme yok. Reçete girebilmek için malzeme ekleyin.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
                <th className="py-2">Ad</th>
                <th>Birim</th>
                <th className="text-right">kcal/100</th>
                <th className="text-right">P / K / Y</th>
                <th className="text-right">Maliyet</th>
                <th>Alerjen</th>
              </tr>
            </thead>
            <tbody>
              {ingredients.map((i) => (
                <tr key={i.id} className="border-b border-line/60">
                  <td className="py-2 font-medium text-ink">{i.name}</td>
                  <td className="text-muted">{i.unit}</td>
                  <td className="text-right">{i.nutrition_per_100.kcal}</td>
                  <td className="text-right text-muted">
                    {i.nutrition_per_100.protein_g} / {i.nutrition_per_100.carb_g} / {i.nutrition_per_100.fat_g}
                  </td>
                  <td className="text-right text-muted">
                    {i.unit_cost} ₺/{i.cost_unit}
                  </td>
                  <td className="text-xs text-muted">
                    {(i.allergens ?? []).map((a: any) => a.name).join(', ') || '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </AdminShell>
  );
}

function NewIngredient({ allergens, onDone, api }: { allergens: any[]; onDone: () => void; api: any }) {
  const [f, setF] = useState<Record<string, string>>({ unit: 'g', cost_unit: 'kg' });
  const [alg, setAlg] = useState<number[]>([]);

  const set = (k: string, v: string) => setF((s) => ({ ...s, [k]: v }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    await api.createIngredient({
      name: f.name,
      unit: f.unit,
      kcal: Number(f.kcal || 0),
      protein_g: Number(f.protein_g || 0),
      carb_g: Number(f.carb_g || 0),
      fat_g: Number(f.fat_g || 0),
      unit_cost: Number(f.unit_cost || 0),
      cost_unit: f.cost_unit,
      is_vegetarian: true,
      allergens: alg.map((id) => ({ id, trace: false })),
    });
    onDone();
  }

  return (
    <Card>
      <form className="grid gap-4 sm:grid-cols-3" onSubmit={submit}>
        <Field label="Ad">
          <Input required value={f.name ?? ''} onChange={(e) => set('name', e.target.value)} />
        </Field>
        <Field label="Birim">
          <select
            className="w-full rounded-lg border border-line bg-white px-3 py-2.5 text-sm"
            value={f.unit}
            onChange={(e) => set('unit', e.target.value)}
          >
            <option value="g">g</option>
            <option value="ml">ml</option>
            <option value="adet">adet</option>
          </select>
        </Field>
        <Field label="kcal /100">
          <Input type="number" value={f.kcal ?? ''} onChange={(e) => set('kcal', e.target.value)} />
        </Field>
        <Field label="Protein g/100">
          <Input type="number" value={f.protein_g ?? ''} onChange={(e) => set('protein_g', e.target.value)} />
        </Field>
        <Field label="Karb g/100">
          <Input type="number" value={f.carb_g ?? ''} onChange={(e) => set('carb_g', e.target.value)} />
        </Field>
        <Field label="Yağ g/100">
          <Input type="number" value={f.fat_g ?? ''} onChange={(e) => set('fat_g', e.target.value)} />
        </Field>
        <Field label="Birim maliyet">
          <Input type="number" value={f.unit_cost ?? ''} onChange={(e) => set('unit_cost', e.target.value)} />
        </Field>
        <Field label="Maliyet birimi">
          <Input value={f.cost_unit ?? ''} onChange={(e) => set('cost_unit', e.target.value)} />
        </Field>
        <div className="sm:col-span-3">
          <span className="mb-1.5 block text-sm font-medium text-ink">Alerjenler</span>
          <div className="flex flex-wrap gap-2">
            {allergens.map((a) => {
              const on = alg.includes(a.id);
              return (
                <button
                  type="button"
                  key={a.id}
                  onClick={() => setAlg((s) => (on ? s.filter((x) => x !== a.id) : [...s, a.id]))}
                  className={`rounded-full px-3 py-1 text-xs ${
                    on ? 'bg-brand-500 text-white' : 'border border-line bg-white text-muted'
                  }`}
                >
                  {a.name}
                </button>
              );
            })}
          </div>
        </div>
        <div className="sm:col-span-3">
          <Button type="submit">Kaydet</Button>
        </div>
      </form>
    </Card>
  );
}
