'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { AdminShell } from '@/components/AdminShell';
import { CategoryManager } from '@/components/CategoryManager';
import { RecipeEditor } from '@/components/RecipeEditor';
import { Button, Card, Input } from '@/components/ui';
import { compressImage } from '@/lib/image';
import { printMenu } from '@/lib/print-menu';
import { useApi } from '@/lib/useApi';

export default function MenuPage() {
  const t = useTranslations('menu');
  const cm = useTranslations('common');
  const { api, me, ready } = useApi();
  const [printing, setPrinting] = useState(false);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [importing, setImporting] = useState(false);
  const [categories, setCategories] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [ingredients, setIngredients] = useState<any[]>([]);
  const [modifierGroups, setModifierGroups] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [busy, setBusy] = useState<number | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [selectedCat, setSelectedCat] = useState<number | null>(null);
  const [dragProdId, setDragProdId] = useState<number | null>(null);
  const draggingProdRef = useRef<number | null>(null);

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
    setSelectedCat((prev) => (prev && cats.some((c: any) => c.id === prev) ? prev : cats[0]?.id ?? null));
    setLoading(false);
  }, [api]);

  useEffect(() => {
    if (ready) load();
  }, [ready, load]);

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
  async function savePrice(p: any, price: number) {
    await api.updateProduct(p.id, { price });
    load();
  }
  async function saveName(p: any, name: string) {
    await api.updateProduct(p.id, { name });
    load();
  }

  /** Drag-and-drop reorder of products WITHIN one category; persists sort order. */
  function onProductDrop(categoryId: number, overId: number) {
    const from = draggingProdRef.current;
    draggingProdRef.current = null;
    setDragProdId(null);
    if (from == null || from === overId) return;
    const inCat = products.filter((p) => p.category_id === categoryId);
    const fi = inCat.findIndex((p) => p.id === from);
    const ti = inCat.findIndex((p) => p.id === overId);
    if (fi < 0 || ti < 0) return; // only reorder inside the same category
    const reordered = [...inCat];
    const [moved] = reordered.splice(fi, 1);
    reordered.splice(ti, 0, moved);
    // Rewrite this category's slots in the flat list, keeping other categories put.
    // Computed as a plain value (not a setState updater) so it stays pure — a
    // mutable counter inside an updater would double-run under StrictMode.
    let k = 0;
    const next = products.map((p) => (p.category_id === categoryId ? reordered[k++] : p));
    setProducts(next);
    api.reorderProducts(reordered.map((p) => p.id)).catch(() => load());
  }
  async function uploadImage(p: any, file: File) {
    setBusy(p.id);
    setNotice(null);
    try {
      // Shrink before upload so large phone photos don't hit the server's
      // upload_max_filesize (commonly 2 MB) and fail silently. Product images
      // are photos → JPEG for the smallest file.
      const optimized = await compressImage(file, { format: 'jpeg' });
      if (optimized.size > 4 * 1024 * 1024) {
        setNotice(t('imageTooLarge'));
        return;
      }
      await api.uploadProductImage(p.id, optimized);
      load();
    } catch {
      setNotice(t('imageUploadFailed'));
    } finally {
      setBusy(null);
    }
  }

  async function handleImport(files: FileList | null) {
    if (!files || files.length === 0) return;
    setImporting(true);
    setNotice(null);
    try {
      const res = await api.importMenuFromPhotos(Array.from(files).slice(0, 5));
      setNotice(t('importSuccess', { categories: res.categories, products: res.products }));
      load();
    } catch (e: any) {
      const s = e?.status;
      setNotice(
        s === 402
          ? t('importNeedsAiPlan')
          : s === 503
            ? t('aiNotConfiguredVision')
            : s === 422
              ? e?.message ?? t('menuUnreadable')
              : t('importFailed'),
      );
    } finally {
      setImporting(false);
    }
  }

  async function handlePrintMenu() {
    setPrinting(true);
    setNotice(null);
    try {
      const menu = await api.menu(me?.tenant?.slug);
      printMenu(menu);
    } catch {
      setNotice(t('printLoadFailed'));
    } finally {
      setPrinting(false);
    }
  }

  async function downloadPdf() {
    setPdfBusy(true);
    setNotice(null);
    try {
      const blob = await api.downloadMenuPdf();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `menu-${me?.tenant?.slug ?? 'comiqr'}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      setNotice(t('pdfDownloadFailed'));
    } finally {
      setPdfBusy(false);
    }
  }

  async function aiCopy(p: any) {
    setBusy(p.id);
    setNotice(null);
    try {
      const res = await api.aiProductCopy(p.id, true);
      setNotice(t('aiCopyGenerated', { description: res.description }));
      load();
    } catch {
      setNotice(t('aiDisabledOrUnconfigured'));
    } finally {
      setBusy(null);
    }
  }

  if (!ready || loading) {
    return (
      <AdminShell title={t('title')}>
        <p className="text-sm text-muted">{cm('loading')}</p>
      </AdminShell>
    );
  }

  return (
    <AdminShell title={t('managementTitle')}>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted">{t('subtitle')}</p>
        <div className="flex shrink-0 gap-2">
          <Button variant="ghost" onClick={handlePrintMenu} loading={printing}>
            🖨️ {t('printPreview')}
          </Button>
          <Button variant="primary" onClick={downloadPdf} loading={pdfBusy}>
            📄 {t('downloadPdf')}
          </Button>
        </div>
      </div>

      <Card className="mb-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-sm font-bold text-ink">📸 {t('importFromPhotoTitle')}</h2>
            <p className="mt-0.5 text-xs text-muted">{t('importFromPhotoDesc')}</p>
          </div>
          <label
            className={`shrink-0 cursor-pointer rounded-lg bg-brand-500 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-600 ${
              importing ? 'pointer-events-none opacity-60' : ''
            }`}
          >
            {importing ? t('reading') : t('selectFile')}
            <input
              type="file"
              accept="image/*,application/pdf"
              multiple
              disabled={importing}
              className="hidden"
              onChange={(e) => {
                handleImport(e.target.files);
                e.target.value = '';
              }}
            />
          </label>
        </div>
      </Card>

      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-sm font-bold text-ink">{t('categories')}</h2>
        <span className="text-xs text-muted">{t('categoriesHint')}</span>
      </div>
      <CategoryManager
        categories={categories}
        products={products}
        api={api as any}
        selectedId={selectedCat}
        onSelect={(id) => {
          setSelectedCat(id);
          requestAnimationFrame(() =>
            document.getElementById(`cat-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }),
          );
        }}
        onReorder={(ids) =>
          setCategories((prev) => ids.map((id) => prev.find((c) => c.id === id)).filter(Boolean) as any[])
        }
        onChanged={load}
      />

      {notice && (
        <div className="mt-4 rounded-lg bg-brand-50 px-3 py-2 text-sm text-brand-700">{notice}</div>
      )}

      <div className="mt-6 space-y-6">
        {categories.map((c) => (
          <div key={c.id} id={`cat-${c.id}`} className="scroll-mt-24">
          <Card className={selectedCat === c.id ? 'ring-2 ring-brand-200' : ''}>
            <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-brand-600">
              {c.name} · {t('products')}
              {!c.is_active && <span className="ml-2 rounded bg-canvas px-1.5 py-0.5 text-[10px] font-bold text-muted">{cm('disabled')}</span>}
            </h2>
            <ul className="divide-y divide-line">
              {products
                .filter((p) => p.category_id === c.id)
                .map((p) => (
                  <li
                    key={p.id}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={() => onProductDrop(c.id, p.id)}
                    className={`py-2.5 transition ${dragProdId === p.id ? 'opacity-40' : ''}`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-2">
                        <span
                          draggable
                          onDragStart={() => {
                            draggingProdRef.current = p.id;
                            setDragProdId(p.id);
                          }}
                          onDragEnd={() => {
                            draggingProdRef.current = null;
                            setDragProdId(null);
                          }}
                          title={t('dragToReorder')}
                          className="shrink-0 cursor-grab select-none text-muted/60 hover:text-muted active:cursor-grabbing"
                        >
                          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
                            <circle cx="9" cy="6" r="1.5" /><circle cx="15" cy="6" r="1.5" />
                            <circle cx="9" cy="12" r="1.5" /><circle cx="15" cy="12" r="1.5" />
                            <circle cx="9" cy="18" r="1.5" /><circle cx="15" cy="18" r="1.5" />
                          </svg>
                        </span>
                        {p.images?.[0] ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={p.images[0]} alt={p.name} className="h-10 w-10 rounded-lg object-cover" />
                        ) : (
                          <span className="grid h-10 w-10 place-items-center rounded-lg bg-canvas text-xs text-muted">—</span>
                        )}
                        <div className="flex min-w-0 items-center gap-2">
                          <NameEdit product={p} onSave={(name) => saveName(p, name)} />
                          {p.nutrition && (
                            <span className="shrink-0 rounded bg-amber-100 px-1.5 py-0.5 text-xs font-semibold text-amber-800">
                              {Math.round(p.nutrition.kcal)} kcal
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <label className="cursor-pointer rounded-md border border-line px-2 py-0.5 text-xs font-medium text-muted">
                          {cm('image')}
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(e) => e.target.files?.[0] && uploadImage(p, e.target.files[0])}
                          />
                        </label>
                        <PriceEdit product={p} onSave={(price) => savePrice(p, price)} />
                        <button
                          onClick={() => toggleProduct(p)}
                          className={`rounded-md px-2 py-0.5 text-xs font-medium ${
                            p.is_active ? 'bg-emerald-100 text-emerald-800' : 'bg-canvas text-muted'
                          }`}
                        >
                          {p.is_active ? cm('active') : cm('inactive')}
                        </button>
                        <button
                          onClick={() => toggleAge(p)}
                          title={t('ageRestrictTitle')}
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
                          {t('recipeNutrition')}
                        </button>
                        <button
                          onClick={() => aiCopy(p)}
                          disabled={busy === p.id}
                          className="rounded-md border border-line px-2 py-0.5 text-xs font-medium text-muted disabled:opacity-50"
                        >
                          {busy === p.id ? '…' : t('aiCopy')}
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
          </div>
        ))}
      </div>
    </AdminShell>
  );
}

/** Inline, click-to-edit product name. Saves on blur/Enter when changed (non-empty). */
function NameEdit({ product, onSave }: { product: any; onSave: (name: string) => void | Promise<void> }) {
  const t = useTranslations('menu');
  const [val, setVal] = useState<string>(product.name);
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    setVal(product.name);
  }, [product.name]);

  async function commit() {
    const name = val.trim();
    if (!name || name === product.name) {
      setVal(product.name);
      return;
    }
    setSaving(true);
    try {
      await onSave(name);
    } finally {
      setSaving(false);
    }
  }

  return (
    <input
      type="text"
      value={val}
      disabled={saving}
      onChange={(e) => setVal(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
        if (e.key === 'Escape') {
          setVal(product.name);
          (e.target as HTMLInputElement).blur();
        }
      }}
      title={t('editProductName')}
      className={`w-44 max-w-full truncate rounded-md border border-transparent bg-transparent px-1.5 py-0.5 font-medium text-ink outline-none transition hover:border-line focus:w-56 focus:border-brand-400 ${saving ? 'opacity-50' : ''}`}
    />
  );
}

/** Inline, click-to-edit product price. Saves on blur/Enter when changed. */
function PriceEdit({ product, onSave }: { product: any; onSave: (price: number) => void | Promise<void> }) {
  const t = useTranslations('menu');
  const original = Number(product.price).toFixed(0);
  const [val, setVal] = useState(original);
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    setVal(Number(product.price).toFixed(0));
  }, [product.price]);

  async function commit() {
    const n = Number(val);
    if (!Number.isFinite(n) || n < 0 || n === Number(product.price)) {
      setVal(Number(product.price).toFixed(0));
      return;
    }
    setSaving(true);
    try {
      await onSave(n);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className={`flex items-center gap-0.5 rounded-md border px-1.5 py-0.5 transition ${saving ? 'opacity-50' : 'border-line focus-within:border-brand-400'}`}
      title={t('editPrice')}
    >
      <span className="text-xs text-muted">₺</span>
      <input
        type="number"
        min={0}
        inputMode="numeric"
        value={val}
        disabled={saving}
        onChange={(e) => setVal(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
        }}
        className="w-12 bg-transparent text-right text-sm font-semibold text-ink outline-none"
      />
    </div>
  );
}

/** One variant as an inline-editable chip: name + price delta, both save on blur/Enter. */
function VariantChip({ product, variant, api, onChanged }: { product: any; variant: any; api: any; onChanged: () => void }) {
  const t = useTranslations('menu');
  const cm = useTranslations('common');
  const [name, setName] = useState<string>(variant.name);
  const [delta, setDelta] = useState<string>(Number(variant.price_delta).toFixed(0));
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    setName(variant.name);
    setDelta(Number(variant.price_delta).toFixed(0));
  }, [variant.name, variant.price_delta]);

  async function save(body: Record<string, unknown>) {
    setSaving(true);
    try {
      await api.updateVariant(product.id, variant.id, body);
      onChanged();
    } finally {
      setSaving(false);
    }
  }
  function commitName() {
    const n = name.trim();
    if (!n || n === variant.name) return setName(variant.name);
    save({ name: n });
  }
  function commitDelta() {
    const d = Number(delta);
    if (!Number.isFinite(d) || d === Number(variant.price_delta)) return setDelta(Number(variant.price_delta).toFixed(0));
    save({ price_delta: d });
  }
  const enterBlur = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
  };
  const inputCls = 'rounded border border-transparent bg-transparent px-1 text-ink outline-none transition hover:border-line focus:border-brand-400';

  return (
    <span className={`flex items-center gap-1 rounded-full bg-white px-2 py-1 text-xs shadow-sm ${saving ? 'opacity-50' : ''}`}>
      <input
        value={name}
        disabled={saving}
        onChange={(e) => setName(e.target.value)}
        onBlur={commitName}
        onKeyDown={enterBlur}
        title={t('variantName')}
        className={`w-20 font-medium ${inputCls}`}
      />
      <span className="text-muted">+₺</span>
      <input
        type="number"
        value={delta}
        disabled={saving}
        onChange={(e) => setDelta(e.target.value)}
        onBlur={commitDelta}
        onKeyDown={enterBlur}
        title={t('priceDelta')}
        className={`w-12 text-right ${inputCls}`}
      />
      <button
        onClick={async () => {
          await api.deleteVariant(product.id, variant.id);
          onChanged();
        }}
        title={cm('delete')}
        className="ml-0.5 text-red-600"
      >
        ×
      </button>
    </span>
  );
}

function VariantsManager({ product, api, onChanged }: { product: any; api: any; onChanged: () => void }) {
  const t = useTranslations('menu');
  const cm = useTranslations('common');
  const [name, setName] = useState('');
  const [delta, setDelta] = useState('');
  const variants = product.variants ?? [];

  return (
    <div className="mt-3 rounded-xl border border-line bg-canvas p-4">
      <h4 className="mb-2 text-sm font-semibold text-ink">{t('variantsTitle')}</h4>
      <div className="mb-2 flex flex-wrap gap-2">
        {variants.map((v: any) => (
          <VariantChip key={v.id} product={product} variant={v} api={api} onChanged={onChanged} />
        ))}
        {variants.length === 0 && <span className="text-xs text-muted">{t('noVariants')}</span>}
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
        <Input placeholder={t('variantNamePlaceholder')} value={name} onChange={(e) => setName(e.target.value)} />
        <Input placeholder="+₺" type="number" className="w-24" value={delta} onChange={(e) => setDelta(e.target.value)} />
        <Button type="submit" variant="ghost">{cm('add')}</Button>
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
  const t = useTranslations('menu');
  const cm = useTranslations('common');
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
      <h4 className="mb-2 text-sm font-semibold text-ink">{t('modifierGroupsTitle')}</h4>

      {attached.length === 0 && <p className="mb-2 text-xs text-muted">{t('noModifierGroups')}</p>}

      <div className="space-y-3">
        {attached.map((g) => (
          <div key={g.id} className="rounded-lg border border-line bg-white p-3">
            <div className="mb-1.5 flex items-center justify-between gap-2">
              <span className="text-sm font-medium text-ink">
                {g.name}{' '}
                <span className="text-xs font-normal text-muted">
                  ({g.is_required ? cm('required') : cm('optional')} · {g.min_select}–{g.max_select})
                </span>
              </span>
              <button
                onClick={async () => {
                  await api.detachModifierGroup(product.id, g.id);
                  onChanged();
                }}
                className="text-xs font-medium text-red-600"
              >
                {t('detachFromProduct')}
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
              {(g.modifiers ?? []).length === 0 && <span className="text-xs text-muted">{t('noOptions')}</span>}
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
            <option value="">{t('attachExistingGroup')}</option>
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
            {t('attach')}
          </Button>
        </div>
      )}

      <div className="mt-3 border-t border-line pt-3">
        <p className="mb-1.5 text-xs font-medium text-muted">{t('createAndAttachGroup')}</p>
        <div className="flex flex-wrap items-center gap-2">
          <Input
            placeholder={t('groupNamePlaceholder')}
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            className="min-w-[180px] flex-1"
          />
          <label className="flex items-center gap-1 text-xs text-muted">
            {t('min')}
            <Input type="number" className="w-14" value={minSel} onChange={(e) => setMinSel(e.target.value)} />
          </label>
          <label className="flex items-center gap-1 text-xs text-muted">
            {t('max')}
            <Input type="number" className="w-14" value={maxSel} onChange={(e) => setMaxSel(e.target.value)} />
          </label>
          <label className="flex items-center gap-1.5 text-xs text-muted">
            <input type="checkbox" checked={required} onChange={(e) => setRequired(e.target.checked)} />
            {t('required')}
          </label>
          <Button type="button" variant="ghost" onClick={createAndAttach}>
            {cm('create')}
          </Button>
        </div>
      </div>
    </div>
  );
}

function AddOption({ groupId, api, onChanged }: { groupId: number; api: any; onChanged: () => void }) {
  const t = useTranslations('menu');
  const cm = useTranslations('common');
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
      <Input placeholder={t('optionPlaceholder')} value={name} onChange={(e) => setName(e.target.value)} />
      <Input placeholder="+₺" type="number" className="w-24" value={delta} onChange={(e) => setDelta(e.target.value)} />
      <Button type="submit" variant="ghost">
        {cm('add')}
      </Button>
    </form>
  );
}

function AddProduct({ categoryId, onAdd }: { categoryId: number; onAdd: (c: number, n: string, p: number) => void }) {
  const t = useTranslations('menu');
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
      <Input placeholder={t('productNamePlaceholder')} value={name} onChange={(e) => setName(e.target.value)} />
      <Input placeholder="₺" type="number" className="w-24" value={price} onChange={(e) => setPrice(e.target.value)} />
      <Button type="submit" variant="ghost">
        {t('addProduct')}
      </Button>
    </form>
  );
}
