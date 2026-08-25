'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Panel } from '@/components/superadmin-ui';
import { Button } from '@/components/ui';
import { MARKETING_LOCALES, MARKETING_LOCALE_NAMES, type MarketingLocale } from '@/i18n/locales';
import { useApi } from '@/lib/useApi';

/**
 * Landing sayfası düzenleyici.
 *
 * Çeviri dosyaları VARSAYILAN olarak kalır; burada yalnızca değiştirilen alanlar
 * kaydedilir. Bir alanı boşaltmak onu silip çeviriye geri döndürür — yani panel
 * sayfayı asla eksik bırakamaz. Alanlar çeviri ağacından türetildiği için
 * dosyaya yeni bir bölüm eklendiğinde burada kendiliğinden görünür.
 */

/** Görsel yuvaları: sayfada nereye bastıklarını yazıyoruz, tahmin ettirmeyelim. */
const MEDIA_SLOTS: { slot: string; title: string; hint: string }[] = [
  {
    slot: 'heroPhone',
    title: 'Hero telefon görüntüsü',
    hint: 'Üst bölümdeki telefonun ekranına basılır. Dik (mobil) bir ekran görüntüsü yükleyin — önerilen 375×812. Yüklenmezse telefon canlı demo menüyü gömer.',
  },
  { slot: 'ogImage', title: 'Paylaşım görseli (og:image)', hint: 'Bağlantı WhatsApp/X/LinkedIn’de paylaşıldığında görünen kart görseli. Önerilen 1200×630.' },
  { slot: 'logo', title: 'Logo', hint: 'Üst menüdeki logo. Yüklenmezse yerleşik logo kullanılır.' },
];

/** Ağacı `hero.title1`, `faq.items.0.q` gibi düz yollara çevirir. */
function flatten(node: any, prefix = ''): Record<string, string> {
  if (typeof node === 'string') return { [prefix]: node };
  if (Array.isArray(node)) {
    return node.reduce((acc, value, i) => Object.assign(acc, flatten(value, `${prefix}.${i}`)), {});
  }
  if (node && typeof node === 'object') {
    return Object.entries(node).reduce(
      (acc, [key, value]) => Object.assign(acc, flatten(value, prefix ? `${prefix}.${key}` : key)),
      {},
    );
  }

  return {};
}

const sectionOf = (path: string) => path.split('.')[0];

/** `sections.finance.points.2` → `finance › points › 3` — yolun kendisi etiket olur. */
function labelOf(path: string) {
  return path
    .split('.')
    .slice(1)
    .map((part) => (/^\d+$/.test(part) ? `#${Number(part) + 1}` : part))
    .join(' › ');
}

export default function LandingEditorPage() {
  const { api, ready } = useApi();

  const [locale, setLocale] = useState<MarketingLocale>('tr');
  const [defaults, setDefaults] = useState<Record<string, string>>({});
  const [values, setValues] = useState<Record<string, string>>({});
  const [media, setMedia] = useState<Record<string, string>>({});
  const [open, setOpen] = useState<string | null>('hero');
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  const load = useCallback(async () => {
    setStatus(null);
    // Varsayılanlar panelde duruyor (API yalnız üzerine yazılanları biliyor).
    const file = (await import(`../../../../messages/marketing/${locale}.json`)).default;
    const flat = flatten(file);
    setDefaults(flat);

    try {
      const saved = await api.superLanding(locale);
      setMedia(saved.media ?? {});
      setValues({ ...flat, ...(saved.overrides ?? {}) });
    } catch {
      setValues(flat);
      setStatus('Kayıtlı düzenlemeler okunamadı; dosyadaki metin gösteriliyor.');
    }
  }, [api, locale]);

  useEffect(() => {
    if (ready) void load();
  }, [ready, load]);

  const groups = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const path of Object.keys(defaults)) {
      const key = sectionOf(path);
      map.set(key, [...(map.get(key) ?? []), path]);
    }

    return [...map.entries()];
  }, [defaults]);

  /** Yalnız varsayılandan FARKLI olanlar kaydedilir. */
  const changed = useMemo(
    () => Object.keys(values).filter((path) => values[path] !== defaults[path]),
    [values, defaults],
  );

  async function save() {
    setBusy(true);
    setStatus(null);
    try {
      const overrides = Object.fromEntries(changed.map((path) => [path, values[path]]));
      await api.superSaveLanding(locale, overrides);
      setStatus(`Kaydedildi — ${changed.length} alan özelleştirildi. Sayfa en geç bir dakikada güncellenir.`);
    } catch {
      setStatus('Kaydedilemedi.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <Panel
        title="Landing sayfası"
        right={
          <div className="flex items-center gap-2">
            <select
              value={locale}
              onChange={(e) => setLocale(e.target.value as MarketingLocale)}
              className="rounded-lg border border-line bg-surface px-2.5 py-1.5 text-sm"
            >
              {MARKETING_LOCALES.map((code) => (
                <option key={code} value={code}>
                  {MARKETING_LOCALE_NAMES[code]}
                </option>
              ))}
            </select>
            <Button onClick={save} disabled={busy || changed.length === 0}>
              {busy ? 'Kaydediliyor…' : `Kaydet (${changed.length})`}
            </Button>
          </div>
        }
      >
        <p className="text-sm text-muted">
          Buradaki metin çeviri dosyasının <b>üzerine</b> yazılır. Bir alanı boşaltırsanız çevirideki
          hâline geri döner; hiç düzenleme yapılmazsa sayfa bugünkü hâliyle yayınlanır.
        </p>
        {status && <p className="mt-2 text-sm font-semibold text-brand-600">{status}</p>}
      </Panel>

      <MediaPanel media={media} onChange={setMedia} />

      {groups.map(([group, paths]) => {
        const dirty = paths.filter((p) => values[p] !== defaults[p]).length;

        return (
          <Panel
            key={group}
            title={dirty > 0 ? `${group} · ${dirty} değişik` : group}
            right={
              <button type="button" onClick={() => setOpen(open === group ? null : group)} className="text-sm font-semibold text-brand-600">
                {open === group ? 'Kapat' : `Aç (${paths.length})`}
              </button>
            }
          >
            {open === group && (
              <div className="space-y-3">
                {paths.map((path) => {
                  const isDirty = values[path] !== defaults[path];
                  const long = (defaults[path] ?? '').length > 90;

                  return (
                    <div key={path}>
                      <div className="flex items-center justify-between gap-2">
                        <label className="text-xs font-semibold text-muted">{labelOf(path) || path}</label>
                        {isDirty && (
                          <button
                            type="button"
                            onClick={() => setValues((v) => ({ ...v, [path]: defaults[path] }))}
                            className="text-[11px] font-semibold text-brand-600"
                          >
                            varsayılana dön
                          </button>
                        )}
                      </div>
                      {long ? (
                        <textarea
                          value={values[path] ?? ''}
                          onChange={(e) => setValues((v) => ({ ...v, [path]: e.target.value }))}
                          rows={3}
                          className={`mt-1 w-full rounded-lg border bg-surface px-3 py-2 text-sm ${isDirty ? 'border-brand-500' : 'border-line'}`}
                        />
                      ) : (
                        <input
                          value={values[path] ?? ''}
                          onChange={(e) => setValues((v) => ({ ...v, [path]: e.target.value }))}
                          className={`mt-1 w-full rounded-lg border bg-surface px-3 py-2 text-sm ${isDirty ? 'border-brand-500' : 'border-line'}`}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </Panel>
        );
      })}
    </div>
  );
}

function MediaPanel({ media, onChange }: { media: Record<string, string>; onChange: (m: Record<string, string>) => void }) {
  const { api } = useApi();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputs = useRef<Record<string, HTMLInputElement | null>>({});

  async function upload(slot: string, file: File) {
    setBusy(slot);
    setError(null);
    try {
      const saved = await api.superUploadLandingMedia(slot, file);
      onChange({ ...media, [slot]: saved.url });
    } catch {
      setError('Yüklenemedi. JPG/PNG/WebP, en fazla 4 MB.');
    } finally {
      setBusy(null);
    }
  }

  async function remove(slot: string) {
    setBusy(slot);
    try {
      await api.superDeleteLandingMedia(slot);
      const next = { ...media };
      delete next[slot];
      onChange(next);
    } catch {
      setError('Kaldırılamadı.');
    } finally {
      setBusy(null);
    }
  }

  return (
    <Panel title="Görseller">
      {error && <p className="mb-3 text-sm font-semibold text-red-600">{error}</p>}
      <div className="grid gap-4 sm:grid-cols-3">
        {MEDIA_SLOTS.map(({ slot, title, hint }) => (
          <div key={slot} className="rounded-xl border border-line p-3">
            <div className="text-sm font-bold">{title}</div>
            <p className="mt-1 text-xs leading-relaxed text-muted">{hint}</p>

            <div className="mt-3 grid h-40 place-items-center overflow-hidden rounded-lg bg-canvas">
              {media[slot] ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={media[slot]} alt="" className="h-full w-full object-contain" />
              ) : (
                <span className="text-xs text-muted">Yerleşik görsel kullanılıyor</span>
              )}
            </div>

            <input
              ref={(el) => {
                inputs.current[slot] = el;
              }}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void upload(slot, file);
                e.target.value = '';
              }}
            />

            <div className="mt-3 flex items-center gap-2">
              <Button onClick={() => inputs.current[slot]?.click()} disabled={busy === slot}>
                {busy === slot ? 'Yükleniyor…' : media[slot] ? 'Değiştir' : 'Yükle'}
              </Button>
              {media[slot] && (
                <button type="button" onClick={() => void remove(slot)} className="text-sm font-semibold text-red-600">
                  Kaldır
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </Panel>
  );
}
