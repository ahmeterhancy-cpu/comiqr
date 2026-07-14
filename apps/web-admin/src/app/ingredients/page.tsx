'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { AdminShell } from '@/components/AdminShell';
import { Button, Card, Field, Input } from '@/components/ui';
import { useApi } from '@/lib/useApi';

export default function IngredientsPage() {
  const t = useTranslations('ingredients');
  const c = useTranslations('common');
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
    <AdminShell title={t('title')}>
      <div className="mb-4">
        <Button onClick={() => setOpen((v) => !v)}>{open ? c('close') : t('addIngredient')}</Button>
      </div>

      {open && <NewIngredient allergens={allergens} onDone={() => { setOpen(false); load(); }} api={api} />}

      <Card className="mt-4">
        {ingredients.length === 0 ? (
          <p className="text-sm text-muted">{t('noIngredients')}</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
                <th className="py-2">{c('name')}</th>
                <th>{t('unit')}</th>
                <th className="text-right">{t('kcalHeader')}</th>
                <th className="text-right">{t('macrosShort')}</th>
                <th className="text-right">{t('cost')}</th>
                <th>{t('allergen')}</th>
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
  const t = useTranslations('ingredients');
  const c = useTranslations('common');
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
        <Field label={c('name')}>
          <Input required value={f.name ?? ''} onChange={(e) => set('name', e.target.value)} />
        </Field>
        <Field label={t('unit')}>
          <select
            className="w-full rounded-lg border border-line bg-white px-3 py-2.5 text-sm"
            value={f.unit}
            onChange={(e) => set('unit', e.target.value)}
          >
            <option value="g">g</option>
            <option value="ml">ml</option>
            <option value="adet">{t('unitPiece')}</option>
          </select>
        </Field>
        <Field label={t('kcalFieldLabel')}>
          <Input type="number" value={f.kcal ?? ''} onChange={(e) => set('kcal', e.target.value)} />
        </Field>
        <Field label={t('proteinField')}>
          <Input type="number" value={f.protein_g ?? ''} onChange={(e) => set('protein_g', e.target.value)} />
        </Field>
        <Field label={t('carbField')}>
          <Input type="number" value={f.carb_g ?? ''} onChange={(e) => set('carb_g', e.target.value)} />
        </Field>
        <Field label={t('fatField')}>
          <Input type="number" value={f.fat_g ?? ''} onChange={(e) => set('fat_g', e.target.value)} />
        </Field>
        <Field label={t('unitCost')}>
          <Input type="number" value={f.unit_cost ?? ''} onChange={(e) => set('unit_cost', e.target.value)} />
        </Field>
        <Field label={t('costUnit')}>
          <Input value={f.cost_unit ?? ''} onChange={(e) => set('cost_unit', e.target.value)} />
        </Field>
        <div className="sm:col-span-3">
          <span className="mb-1.5 block text-sm font-medium text-ink">{t('allergens')}</span>
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
          <Button type="submit">{c('save')}</Button>
        </div>
      </form>
    </Card>
  );
}
