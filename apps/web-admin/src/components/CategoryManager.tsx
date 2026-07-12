'use client';

import { useEffect, useRef, useState } from 'react';
import { ImageCropperField } from '@/components/ImageCropperField';

type Promo = { active: boolean; percent: number; label: string | null };
type Cat = { id: number; name: string; image_path?: string | null; is_active: boolean; sort?: number; promo?: Promo };
type Api = {
  createCategory: (b: Record<string, unknown>) => Promise<any>;
  updateCategory: (id: number, b: Record<string, unknown>) => Promise<any>;
  deleteCategory: (id: number) => Promise<any>;
  reorderCategories: (ids: number[]) => Promise<any>;
  uploadCategoryImage: (f: File) => Promise<{ url: string }>;
};

/**
 * Category card grid for the menu builder: cover image + name + on/off toggle +
 * ⋮ menu, a "+ Kategori Ekle" card, native drag-and-drop reordering, and a
 * "Kategori Oluştur/Düzenle" modal (name + image). Selecting a card drives the
 * product editor shown below (onSelect).
 */
export function CategoryManager({
  categories,
  products,
  api,
  selectedId,
  onSelect,
  onReorder,
  onChanged,
}: {
  categories: Cat[];
  products: any[];
  api: Api;
  selectedId: number | null;
  onSelect: (id: number) => void;
  /** New id order after a drag — lets the parent re-order its list (e.g. the product sections). */
  onReorder?: (ids: number[]) => void;
  onChanged: () => void;
}) {
  const [order, setOrder] = useState<Cat[]>(categories);
  const [modal, setModal] = useState<null | { mode: 'create' | 'edit'; cat?: Cat }>(null);
  const [promoFor, setPromoFor] = useState<Cat | null>(null);
  const [menuFor, setMenuFor] = useState<number | null>(null);
  const [dragId, setDragId] = useState<number | null>(null);
  const draggingRef = useRef<number | null>(null);

  // Keep the local (optimistically re-orderable) copy in sync with the server list:
  // preserve the current drag order but refresh each card's data (promo, active, image).
  useEffect(() => {
    setOrder((prev) => {
      const sameSet = prev.length === categories.length && prev.every((c) => categories.some((x) => x.id === c.id));
      if (!sameSet) return categories;
      const byId = new Map(categories.map((c) => [c.id, c]));
      return prev.map((c) => byId.get(c.id) ?? c);
    });
  }, [categories]);

  async function toggle(cat: Cat) {
    setOrder((prev) => prev.map((c) => (c.id === cat.id ? { ...c, is_active: !c.is_active } : c)));
    try {
      await api.updateCategory(cat.id, { is_active: !cat.is_active });
    } finally {
      onChanged();
    }
  }

  async function remove(cat: Cat) {
    setMenuFor(null);
    if (!window.confirm(`"${cat.name}" kategorisi ve içindeki ürünler silinsin mi?`)) return;
    await api.deleteCategory(cat.id);
    onChanged();
  }

  function onDrop(overId: number) {
    const from = draggingRef.current;
    draggingRef.current = null;
    setDragId(null);
    if (from == null || from === overId) return;
    const cur = [...order];
    const fi = cur.findIndex((c) => c.id === from);
    const ti = cur.findIndex((c) => c.id === overId);
    if (fi < 0 || ti < 0) return;
    const [moved] = cur.splice(fi, 1);
    cur.splice(ti, 0, moved);
    setOrder(cur);
    const ids = cur.map((c) => c.id);
    onReorder?.(ids); // keep the product sections below in the same order
    api.reorderCategories(ids).catch(() => onChanged());
  }

  return (
    <div>
      <div className="flex flex-wrap gap-3">
        {/* + Add card */}
        <button
          type="button"
          onClick={() => setModal({ mode: 'create' })}
          className="grid h-36 w-36 shrink-0 place-items-center rounded-2xl border-2 border-dashed border-line text-muted transition hover:border-brand-400 hover:bg-brand-50/40 hover:text-brand-600"
        >
          <div className="text-center">
            <svg viewBox="0 0 24 24" className="mx-auto h-7 w-7" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14" /></svg>
            <span className="mt-1 block text-xs font-semibold">Kategori Ekle</span>
          </div>
        </button>

        {order.map((c) => {
          const selected = selectedId === c.id;
          return (
            <div
              key={c.id}
              draggable
              onDragStart={() => {
                draggingRef.current = c.id;
                setDragId(c.id);
              }}
              onDragEnd={() => {
                draggingRef.current = null;
                setDragId(null);
              }}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => onDrop(c.id)}
              onClick={() => onSelect(c.id)}
              className={`group relative h-36 w-36 shrink-0 cursor-pointer overflow-hidden rounded-2xl border bg-canvas shadow-sm transition ${
                selected ? 'border-brand-500 ring-2 ring-brand-200' : 'border-line hover:border-brand-300'
              } ${dragId === c.id ? 'opacity-50' : ''} ${!c.is_active ? 'grayscale' : ''}`}
              title="Sürükleyerek sıralayın"
            >
              {c.image_path ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={c.image_path} alt={c.name} draggable={false} className="absolute inset-0 h-full w-full object-cover" />
              ) : (
                <div className="absolute inset-0 grid place-items-center bg-gradient-to-br from-brand-100 to-brand-50 text-2xl font-black text-brand-300">
                  {c.name.slice(0, 1).toUpperCase()}
                </div>
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-black/25" />

              {/* On/off toggle */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  toggle(c);
                }}
                title={c.is_active ? 'Açık — kapatmak için tıkla' : 'Kapalı — açmak için tıkla'}
                className={`absolute left-2 top-2 flex h-5 w-9 items-center rounded-full p-0.5 transition ${c.is_active ? 'bg-emerald-500' : 'bg-white/50'}`}
              >
                <span className={`h-4 w-4 rounded-full bg-white shadow transition ${c.is_active ? 'translate-x-4' : ''}`} />
              </button>

              {/* ⋮ menu */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setMenuFor(menuFor === c.id ? null : c.id);
                }}
                aria-label="Menü"
                className="absolute right-2 top-2 grid h-7 w-7 place-items-center rounded-lg bg-white/85 text-ink shadow transition hover:bg-white"
              >
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor"><circle cx="12" cy="5" r="1.6" /><circle cx="12" cy="12" r="1.6" /><circle cx="12" cy="19" r="1.6" /></svg>
              </button>
              {menuFor === c.id && (
                <>
                  <div className="fixed inset-0 z-10" onClick={(e) => { e.stopPropagation(); setMenuFor(null); }} />
                  <div className="absolute right-2 top-10 z-20 w-36 overflow-hidden rounded-xl border border-line bg-white py-1 text-left shadow-lg" onClick={(e) => e.stopPropagation()}>
                    <button type="button" onClick={() => { setMenuFor(null); setModal({ mode: 'edit', cat: c }); }} className="block w-full px-3 py-1.5 text-left text-sm text-ink hover:bg-canvas">Düzenle</button>
                    <button type="button" onClick={() => { setMenuFor(null); setPromoFor(c); }} className="block w-full px-3 py-1.5 text-left text-sm text-ink hover:bg-canvas">Promosyon</button>
                    <button type="button" onClick={() => remove(c)} className="block w-full px-3 py-1.5 text-left text-sm text-red-600 hover:bg-red-50">Sil</button>
                  </div>
                </>
              )}

              {c.promo?.active && (
                <span className="absolute left-1/2 top-2 -translate-x-1/2 rounded-full bg-red-500 px-2 py-0.5 text-[10px] font-black text-white shadow" style={{ color: '#ffffff' }}>
                  %{Math.round(c.promo.percent)} İNDİRİM
                </span>
              )}
              <span className="absolute bottom-2 left-2 right-2 truncate text-sm font-bold text-white drop-shadow" style={{ color: '#ffffff' }}>
                {c.name}
              </span>
              {!c.is_active && <span className="absolute bottom-2 right-2 rounded bg-black/60 px-1.5 py-0.5 text-[10px] font-bold text-white" style={{ color: '#ffffff' }}>Kapalı</span>}
            </div>
          );
        })}
      </div>

      {modal && (
        <CategoryModal
          mode={modal.mode}
          cat={modal.cat}
          api={api}
          onClose={() => setModal(null)}
          onSaved={() => {
            setModal(null);
            onChanged();
          }}
        />
      )}

      {promoFor && (
        <CategoryPromoModal
          cat={promoFor}
          products={products.filter((p) => p.category_id === promoFor.id)}
          api={api}
          onClose={() => setPromoFor(null)}
          onSaved={() => {
            setPromoFor(null);
            onChanged();
          }}
        />
      )}
    </div>
  );
}

const QUICK = [5, 10, 15, 20, 25, 30, 50];

/** Set a percent discount for every product in a category, with a live price preview. */
function CategoryPromoModal({
  cat,
  products,
  api,
  onClose,
  onSaved,
}: {
  cat: Cat;
  products: any[];
  api: Api;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [percent, setPercent] = useState<number>(cat.promo?.active ? Math.round(cat.promo.percent) : 20);
  const [label, setLabel] = useState<string>(cat.promo?.label ?? '');
  const [showLabel, setShowLabel] = useState<boolean>(!!cat.promo?.label);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fmt = new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', minimumFractionDigits: 0 });
  const factor = 1 - percent / 100;

  async function save(enabled: boolean) {
    setBusy(true);
    setError(null);
    try {
      await api.updateCategory(cat.id, {
        promo_json: { enabled, percent: enabled ? percent : 0, label: enabled ? label.trim() || null : null },
      });
      onSaved();
    } catch {
      setError('Kaydedilemedi, tekrar deneyin.');
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4">
      <div className="flex max-h-[88vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-surface shadow-2xl">
        <div className="flex items-center justify-between border-b border-line px-6 py-4">
          <div>
            <h2 className="text-lg font-extrabold tracking-tight text-ink">Promosyon: {cat.name}</h2>
            <p className="text-xs text-muted">Bu kategorideki tüm ürünler için yüzde indirim belirleyin.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Kapat" className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-muted transition hover:bg-canvas hover:text-ink">
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
          {/* Quick chips */}
          <div className="flex flex-wrap gap-2">
            {QUICK.map((q) => (
              <button
                key={q}
                type="button"
                onClick={() => setPercent(q)}
                className={`rounded-full border px-3 py-1 text-sm font-semibold transition ${percent === q ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-line text-muted hover:border-brand-300'}`}
              >
                %{q}
              </button>
            ))}
          </div>

          {/* Slider */}
          <div className="mt-4 rounded-xl bg-canvas p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-ink">İndirim Oranı</span>
              <span className="text-2xl font-black text-red-500">%{percent}</span>
            </div>
            <input type="range" min={1} max={95} step={1} value={percent} onChange={(e) => setPercent(Number(e.target.value))} className="mt-2 w-full accent-[#ef4444]" />
            <div className="mt-1 flex justify-between text-[11px] text-muted"><span>%1</span><span>%25</span><span>%50</span><span>%75</span><span>%95</span></div>
          </div>

          {/* Optional label */}
          <button type="button" onClick={() => setShowLabel((v) => !v)} className="mt-4 flex w-full items-center justify-between rounded-xl border border-line px-4 py-3 text-sm font-medium text-ink">
            <span>Tanıtım açıklaması <span className="text-muted">( İsteğe bağlı )</span></span>
            <svg viewBox="0 0 24 24" className={`h-4 w-4 text-muted transition ${showLabel ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6" /></svg>
          </button>
          {showLabel && (
            <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Örn. Hafta sonu fırsatı" className="mt-2 w-full rounded-xl border border-line bg-white px-3.5 py-2.5 text-sm outline-none focus:border-brand-500" />
          )}

          {/* Price preview */}
          <div className="mt-5">
            <h3 className="mb-2 text-sm font-bold text-ink">Fiyat Önizlemesi</h3>
            {products.length === 0 ? (
              <p className="rounded-lg bg-canvas px-3 py-2 text-sm text-muted">Bu kategoride ürün yok.</p>
            ) : (
              <div className="space-y-3 rounded-xl border border-line p-3">
                {products.map((p) => {
                  const rows: { name: string; base: number }[] = (p.variants ?? []).length
                    ? p.variants.map((v: any) => ({ name: v.name, base: Number(p.price) + Number(v.price_delta) }))
                    : [{ name: '1 Porsiyon', base: Number(p.price) }];
                  return (
                    <div key={p.id}>
                      <div className="text-xs font-bold uppercase tracking-wide text-muted">{p.name}</div>
                      {rows.map((r, i) => {
                        const disc = Math.round(r.base * factor * 100) / 100;
                        return (
                          <div key={i} className="flex items-center justify-between py-0.5 text-sm">
                            <span className="text-ink">{r.name}</span>
                            <span className="flex items-center gap-2">
                              <span className="text-xs text-muted line-through">{fmt.format(r.base)}</span>
                              <b className="text-ink">{fmt.format(disc)}</b>
                              <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-[11px] font-semibold text-emerald-700">−{fmt.format(r.base - disc)}</span>
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {error && <div className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
        </div>

        <div className="flex items-center justify-between gap-2 border-t border-line px-6 py-4">
          {cat.promo?.active ? (
            <button type="button" onClick={() => save(false)} disabled={busy} className="rounded-xl border border-line px-4 py-2 text-sm font-semibold text-red-600 transition hover:bg-red-50 disabled:opacity-60">Promosyonu Kaldır</button>
          ) : (
            <span />
          )}
          <div className="flex items-center gap-2">
            <button type="button" onClick={onClose} className="rounded-xl border border-line px-5 py-2 text-sm font-semibold text-ink transition hover:bg-canvas">İptal</button>
            <button type="button" onClick={() => save(true)} disabled={busy} className="rounded-xl bg-brand-500 px-6 py-2 text-sm font-bold text-white transition hover:bg-brand-600 disabled:opacity-60" style={{ color: '#ffffff' }}>
              {busy ? 'Kaydediliyor…' : cat.promo?.active ? 'Güncelle' : 'Uygula'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function CategoryModal({
  mode,
  cat,
  api,
  onClose,
  onSaved,
}: {
  mode: 'create' | 'edit';
  cat?: Cat;
  api: Api;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(cat?.name ?? '');
  const [image, setImage] = useState<string | null>(cat?.image_path ?? null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    if (!name.trim()) {
      setError('Kategori adı gerekli.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      if (mode === 'create') await api.createCategory({ name: name.trim(), image_path: image });
      else if (cat) await api.updateCategory(cat.id, { name: name.trim(), image_path: image });
      onSaved();
    } catch {
      setError('Kaydedilemedi, tekrar deneyin.');
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4">
      <div className="flex max-h-[88vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-surface shadow-2xl">
        <div className="flex items-center justify-between border-b border-line px-6 py-4">
          <h2 className="text-lg font-extrabold tracking-tight text-ink">{mode === 'create' ? 'Kategori Oluştur' : 'Kategori Düzenle'}</h2>
          <button type="button" onClick={onClose} aria-label="Kapat" className="grid h-8 w-8 place-items-center rounded-lg text-muted transition hover:bg-canvas hover:text-ink">
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
          <label className="mb-1.5 block text-sm font-medium text-ink">
            Kategori Adı <span className="text-red-500">*</span>
          </label>
          <div className="flex overflow-hidden rounded-xl border border-line focus-within:border-brand-500">
            <span className="grid place-items-center border-r border-line bg-canvas px-3 text-sm font-semibold text-brand-600">Türkçe</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Kategori adı girin"
              autoFocus
              className="min-w-0 flex-1 bg-white px-3.5 py-2.5 text-sm outline-none"
            />
          </div>

          <div className="mt-4">
            <label className="mb-1.5 block text-sm font-medium text-ink">Kategori Görseli</label>
            <ImageCropperField kind="category" aspect={1} url={image} onChange={setImage} upload={(f) => api.uploadCategoryImage(f)} />
          </div>

          {error && <div className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-line px-6 py-4">
          <button type="button" onClick={onClose} className="rounded-xl border border-line px-5 py-2 text-sm font-semibold text-ink transition hover:bg-canvas">İptal</button>
          <button type="button" onClick={save} disabled={busy} className="rounded-xl bg-brand-500 px-6 py-2 text-sm font-bold text-white transition hover:bg-brand-600 disabled:opacity-60" style={{ color: '#ffffff' }}>
            {busy ? 'Kaydediliyor…' : mode === 'create' ? 'Oluştur' : 'Kaydet'}
          </button>
        </div>
      </div>
    </div>
  );
}
