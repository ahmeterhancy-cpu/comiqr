'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AdminShell } from '@/components/AdminShell';
import { useApi } from '@/lib/useApi';

const LANGS: [string, string][] = [
  ['tr', 'Türkçe'],
  ['en', 'English'],
  ['de', 'Deutsch'],
  ['ru', 'Русский'],
  ['ar', 'العربية'],
];
const DAYS = ['Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi', 'Pazar'];
const TEXT_COLORS = ['#111827', '#ffffff', '#4b5563', '#15803d', '#2563eb', '#7c3aed', '#ea580c', '#dc2626'];
const PAGE_COLORS = ['#ffffff', '#f9fafb', '#f3f4f6', '#faf7f2', '#f7f7f4', '#fdf6e3', '#f0f7f0', '#fdf2f2'];
const CUSTOMER_URL = process.env.NEXT_PUBLIC_CUSTOMER_URL ?? 'http://localhost:3010';
const DEVICES: { key: 'phone' | 'tablet' | 'desktop'; label: string; w: number; h: number }[] = [
  { key: 'phone', label: 'Telefon', w: 390, h: 720 },
  { key: 'tablet', label: 'Tablet', w: 768, h: 820 },
  { key: 'desktop', label: 'Masaüstü', w: 1024, h: 720 },
];

export default function MenuBuilderPage() {
  const { api, me, ready } = useApi();
  const [menu, setMenu] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  // Settings
  const [lang, setLang] = useState('tr');
  const [showDesc, setShowDesc] = useState(true);
  const [showIng, setShowIng] = useState(true);
  const [showPrices, setShowPrices] = useState(true);
  const [showWifi, setShowWifi] = useState(true);
  const [columns, setColumns] = useState<1 | 2>(2);
  const [priceRow, setPriceRow] = useState(false); // false = inline, true = different row
  const [textColor, setTextColor] = useState('#111827');
  const [pageColor, setPageColor] = useState('#ffffff');
  const [decoration, setDecoration] = useState<'none' | 'border' | 'double' | 'dotted'>('none');
  const [contacts, setContacts] = useState<Record<string, boolean>>({});
  const [device, setDevice] = useState<'phone' | 'tablet' | 'desktop'>('phone');
  const [reloadKey, setReloadKey] = useState(0);
  const [tenantSettings, setTenantSettings] = useState<any>({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const slug = me?.tenant?.slug;

  // Load the owner's current QR-menu display settings so the toggles reflect them.
  useEffect(() => {
    if (!ready) return;
    api.getTenant().then((t: any) => {
      const s = t?.settings ?? {};
      setTenantSettings(s);
      setShowDesc(s.show_descriptions ?? true);
      setShowIng(s.show_ingredients ?? true);
      setShowPrices(s.show_prices ?? true);
      setShowWifi(s.show_wifi ?? true);
      const hidden: string[] = Array.isArray(s.hidden_contacts) ? s.hidden_contacts : [];
      const keys = ['phone', 'whatsapp', 'email', 'website'].filter((k) => s[k]);
      setContacts(Object.fromEntries(keys.map((k) => [k, !hidden.includes(k)])));
      if (t?.locale_default) setLang(t.locale_default);
      setTimeout(() => (inited.current = true), 0); // enable auto-save after the initial sync
    }).catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  // Auto-apply content/contact/language changes to the live QR menu (debounced).
  const inited = useRef(false);
  useEffect(() => {
    if (!inited.current) return;
    const id = setTimeout(() => saveToQr(), 600);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showDesc, showIng, showPrices, showWifi, contacts, lang]);

  /** Persist the display toggles + contacts + language to the live QR menu. */
  async function saveToQr() {
    setSaving(true);
    setSaved(false);
    try {
      const hidden = contactList.filter((c) => !contacts[c.key]).map((c) => c.key);
      await api.updateTenant({
        locale_default: lang,
        settings_json: {
          show_descriptions: showDesc,
          show_ingredients: showIng,
          show_prices: showPrices,
          show_wifi: showWifi,
          hidden_contacts: hidden,
        },
      } as any);
      setSaved(true);
      setReloadKey((k) => k + 1); // refresh the live QR preview
      setTimeout(() => setSaved(false), 2000);
    } catch {
      /* keep the form as-is on error */
    } finally {
      setSaving(false);
    }
  }

  const load = useCallback(async () => {
    if (!slug) return;
    setLoading(true);
    try {
      const m = await api.menu(slug, lang);
      setMenu(m);
    } finally {
      setLoading(false);
    }
  }, [api, slug, lang]);

  useEffect(() => {
    if (ready && slug) {
      setLang(me?.tenant?.locale_default ?? 'tr');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, slug]);

  useEffect(() => {
    if (ready) load();
  }, [ready, load]);

  const venue = menu?.venue ?? {};
  const currency = venue.currency || 'TRY';
  const fmt = useMemo(
    () => new Intl.NumberFormat(lang, { style: 'currency', currency, maximumFractionDigits: 2 }),
    [lang, currency],
  );

  // Live QR-menu preview (right side) — the actual customer menu in a device frame.
  const previewSlug = slug ?? venue.slug;
  const dev = DEVICES.find((d) => d.key === device)!;
  const frameScale = device === 'desktop' ? 0.86 : 1;
  const previewUrl = previewSlug
    ? `${CUSTOMER_URL}/v/${previewSlug}?${new URLSearchParams({ locale: lang, preview: '1' }).toString()}&_=${reloadKey}`
    : '';

  // Contact channels from the tenant settings (raw values — the menu payload hides
  // some, so we read the source of truth here to keep them toggleable).
  const contactList = useMemo(() => {
    const s = tenantSettings;
    const out: { key: string; label: string; value: string }[] = [];
    if (s.phone) out.push({ key: 'phone', label: 'Telefon', value: s.phone });
    if (s.whatsapp) out.push({ key: 'whatsapp', label: 'WhatsApp', value: s.whatsapp });
    if (s.email) out.push({ key: 'email', label: 'E-posta', value: s.email });
    if (s.website) out.push({ key: 'website', label: 'Web', value: s.website });
    return out;
  }, [tenantSettings]);

  const categories = (menu?.categories ?? []).filter((c: any) => (c.products ?? []).length > 0);
  const selectedContacts = contactList.filter((c) => contacts[c.key]);

  function priceParts(p: any): { original?: string; price: string } | null {
    if (!showPrices) return null;
    const variants = Array.isArray(p.variants) ? p.variants : [];
    if (variants.length > 0) {
      return { price: variants.map((v: any) => `${v.name} ${fmt.format(Number(p.price) + Number(v.price_delta ?? 0))}`).join('  ·  ') };
    }
    const price = fmt.format(Number(p.price ?? 0));
    const original = p.original_price != null && Number(p.original_price) > Number(p.price) ? fmt.format(Number(p.original_price)) : undefined;
    return { original, price };
  }

  return (
    <AdminShell title="Menü Builder">
      {/* Print isolation: only the sheet prints */}
      <style>{`@media print {
        body * { visibility: hidden !important; }
        #menu-sheet, #menu-sheet * { visibility: visible !important; }
        #menu-sheet { position: absolute !important; left: 0; top: 0; width: 100% !important; transform: none !important; box-shadow: none !important; margin: 0 !important; border-radius: 0 !important; }
        @page { size: A4; margin: 12mm; }
      }`}</style>

      <div className="flex flex-col gap-6 lg:flex-row">
        {/* ---------- Left: settings ---------- */}
        <aside className="w-full shrink-0 space-y-5 lg:w-80">
          {/* Save to the live QR menu */}
          <button
            type="button"
            onClick={saveToQr}
            disabled={saving}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-500 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-emerald-600 disabled:opacity-60"
            style={{ color: '#ffffff' }}
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M5 12l5 5 9-9" /></svg>
            {saving ? 'Kaydediliyor…' : saved ? 'QR Menüye Kaydedildi' : 'QR Menüye Kaydet'}
          </button>
          <p className="-mt-2 px-1 text-[11px] text-muted">İçerik ve iletişim ayarları canlı QR menünüze uygulanır. (Tasarım/renk ayarları yalnızca PDF içindir.)</p>

          {/* Export */}
          <Section title="Dışa Aktarım">
            <div className="grid grid-cols-2 gap-2">
              <Field label="Menü Dili">
                <Select value={lang} onChange={setLang} options={LANGS} />
              </Field>
              <Field label="İkinci Dil">
                <Select value={''} onChange={() => undefined} options={[['', 'Seçilmedi'], ...LANGS]} disabled />
              </Field>
            </div>
            <p className="mt-2 text-xs text-muted">Menü <b className="text-ink">{LANGS.find((l) => l[0] === lang)?.[1]}</b> dilinde indirilecek.</p>
            <button
              type="button"
              onClick={() => window.print()}
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-brand-500 py-2.5 text-sm font-bold text-white transition hover:bg-brand-600"
              style={{ color: '#ffffff' }}
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M12 3v12m0 0-4-4m4 4 4-4M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" /></svg>
              İndir (PDF / Yazdır)
            </button>
          </Section>

          {/* Content */}
          <Section title="İçerik">
            <Toggle label="Açıklamaları göster" value={showDesc} onChange={setShowDesc} />
            <Toggle label="İçindekileri göster" value={showIng} onChange={setShowIng} />
            <Toggle label="Fiyatları göster" value={showPrices} onChange={setShowPrices} />
            <Toggle label="WiFi göster" value={showWifi} onChange={setShowWifi} />
          </Section>

          {/* Contacts */}
          {contactList.length > 0 && (
            <Section
              title="İletişim"
              right={
                <div className="flex gap-1.5 text-xs">
                  <button type="button" onClick={() => setContacts(Object.fromEntries(contactList.map((c) => [c.key, true])))} className="rounded-lg border border-line px-2 py-0.5 font-semibold text-muted hover:bg-canvas">Tümü</button>
                  <button type="button" onClick={() => setContacts({})} className="rounded-lg border border-line px-2 py-0.5 font-semibold text-muted hover:bg-canvas">Temizle</button>
                </div>
              }
            >
              <div className="space-y-1.5">
                {contactList.map((c) => (
                  <label key={c.key} className="flex items-center gap-2.5 rounded-lg border border-line px-3 py-2 text-sm">
                    <input type="checkbox" checked={!!contacts[c.key]} onChange={(e) => setContacts((p) => ({ ...p, [c.key]: e.target.checked }))} className="accent-brand-500" />
                    <span className="font-medium text-muted">{c.label}</span>
                    <span className="ml-auto truncate text-ink">{c.value}</span>
                  </label>
                ))}
              </div>
            </Section>
          )}

          {/* Design */}
          <Section title="Tasarım">
            <div className="mb-1.5 text-xs font-medium text-muted">Yerleşim</div>
            <div className="grid grid-cols-2 gap-2">
              <Choice active={columns === 1} onClick={() => setColumns(1)} label="Tek Sütun" />
              <Choice active={columns === 2} onClick={() => setColumns(2)} label="İki Sütun" />
            </div>
            <div className="mb-1.5 mt-3 text-xs font-medium text-muted">Fiyat Yerleşimi</div>
            <div className="grid grid-cols-2 gap-2">
              <Choice active={!priceRow} onClick={() => setPriceRow(false)} label="Satır İçi" />
              <Choice active={priceRow} onClick={() => setPriceRow(true)} label="Alt Satır" />
            </div>
          </Section>

          {/* Colors */}
          <Section title="Renkler">
            <div className="mb-1.5 text-xs font-medium text-muted">Yazı Rengi</div>
            <Swatches colors={TEXT_COLORS} value={textColor} onChange={setTextColor} />
            <div className="mb-1.5 mt-3 text-xs font-medium text-muted">Sayfa Rengi</div>
            <Swatches colors={PAGE_COLORS} value={pageColor} onChange={setPageColor} />
            <div className="mb-1.5 mt-3 text-xs font-medium text-muted">Sayfa Süsü</div>
            <Select
              value={decoration}
              onChange={(v) => setDecoration(v as any)}
              options={[
                ['none', 'Süs yok'],
                ['border', 'İnce çerçeve'],
                ['double', 'Çift çerçeve'],
                ['dotted', 'Noktalı çerçeve'],
              ]}
            />
          </Section>
        </aside>

        {/* ---------- Right: live QR menu preview ---------- */}
        <div className="min-w-0 flex-1">
          <div className="mb-3 flex flex-wrap items-center justify-center gap-3">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted">QR Menü Önizleme</span>
            <div className="inline-flex rounded-lg border border-line bg-surface p-0.5">
              {DEVICES.map((d) => (
                <button key={d.key} type="button" onClick={() => setDevice(d.key)} className={`rounded-md px-3 py-1 text-xs font-semibold transition ${device === d.key ? 'bg-brand-500 text-white' : 'text-muted hover:text-ink'}`} style={device === d.key ? { color: '#ffffff' } : undefined}>{d.label}</button>
              ))}
            </div>
            <button type="button" onClick={() => setReloadKey((k) => k + 1)} title="Yenile" className="grid h-8 w-8 place-items-center rounded-lg border border-line text-muted transition hover:bg-canvas">
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 0 1 15-6.7L21 8M21 3v5h-5M21 12a9 9 0 0 1-15 6.7L3 16M3 21v-5h5" /></svg>
            </button>
          </div>

          <div className="grid min-h-[560px] place-items-center overflow-auto rounded-2xl bg-[#eef2f7] p-6">
            {!previewUrl ? (
              <p className="text-sm text-muted">Yükleniyor…</p>
            ) : (
              <div
                className={`relative bg-black shadow-2xl ${device === 'phone' ? 'rounded-[2.2rem] p-2.5' : device === 'tablet' ? 'rounded-[1.6rem] p-3' : 'rounded-xl p-1.5'}`}
                style={{ width: dev.w * frameScale + (device === 'phone' ? 20 : device === 'tablet' ? 24 : 12) }}
              >
                {device === 'phone' && <div className="absolute left-1/2 top-2.5 z-10 h-4 w-24 -translate-x-1/2 rounded-full bg-black" />}
                <iframe
                  key={previewUrl}
                  src={previewUrl}
                  title="QR Menü"
                  className={`block bg-white ${device === 'phone' ? 'rounded-[1.7rem]' : device === 'tablet' ? 'rounded-[1rem]' : 'rounded-lg'}`}
                  style={{ width: dev.w, height: dev.h, transform: `scale(${frameScale})`, transformOrigin: 'top left', border: 0, marginRight: dev.w * (1 - frameScale) * -1, marginBottom: dev.h * (1 - frameScale) * -1 }}
                />
              </div>
            )}
          </div>
        </div>

        {/* Hidden printable sheet — only rendered when printing (İndir) */}
        <div className="hidden print:block">
          <div>
                <div
                  id="menu-sheet"
                  style={{
                    width: 794,
                    background: pageColor,
                    color: textColor,
                    padding: '56px 52px',
                    boxShadow: '0 12px 48px rgba(10,20,40,.22)',
                    fontFamily: 'Georgia, "Times New Roman", serif',
                    minHeight: 1123,
                  }}
                >
                  <div
                    style={{
                      columnCount: columns,
                      columnGap: 40,
                      ...(decoration === 'border'
                        ? { border: '1.5px solid currentColor', padding: 20 }
                        : decoration === 'double'
                          ? { border: '4px double currentColor', padding: 20 }
                          : decoration === 'dotted'
                            ? { border: '2px dotted currentColor', padding: 20 }
                            : {}),
                    }}
                  >
                    {/* Venue block (first column) */}
                    <div style={{ breakInside: 'avoid', textAlign: 'center', marginBottom: 22 }}>
                      {venue.cover && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={venue.cover} alt="" style={{ width: 120, height: 120, objectFit: 'cover', borderRadius: 8, margin: '0 auto 10px', display: 'block' }} />
                      )}
                      {venue.logo && !venue.cover && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={venue.logo} alt="" style={{ width: 64, height: 64, objectFit: 'cover', borderRadius: 10, margin: '0 auto 8px', display: 'block' }} />
                      )}
                      <div style={{ fontSize: 26, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase' }}>{venue.name}</div>
                      {venue.sub_title && <div style={{ fontStyle: 'italic', opacity: 0.7, fontSize: 13, marginTop: 2 }}>{venue.sub_title}</div>}
                      {venue.address && <div style={{ fontSize: 11, opacity: 0.6, marginTop: 4 }}>{venue.address}</div>}
                      {selectedContacts.map((c) => (
                        <div key={c.key} style={{ fontSize: 12, opacity: 0.85, marginTop: 3 }}>{c.value}</div>
                      ))}

                      {Array.isArray(venue.hours) && venue.hours.length === 7 && (
                        <div style={{ marginTop: 14 }}>
                          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 5 }}>Çalışma Saatleri</div>
                          {venue.hours.map((h: any, i: number) => (
                            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, padding: '1px 0', fontWeight: h.today ? 700 : 400 }}>
                              <span>{DAYS[i]}</span>
                              <span style={{ color: h.closed ? '#c0392b' : undefined, fontStyle: h.closed ? 'italic' : undefined }}>
                                {h.closed ? 'Kapalı' : `${h.open} - ${h.close}`}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}

                      {showWifi && venue.wifi_ssid && (
                        <div style={{ marginTop: 12, fontSize: 11, opacity: 0.85 }}>
                          <div>📶 {venue.wifi_ssid}</div>
                          {venue.wifi_password && <div>🔒 {venue.wifi_password}</div>}
                        </div>
                      )}
                    </div>

                    {/* Categories */}
                    {categories.map((c: any) => (
                      <section key={c.id} style={{ breakInside: 'avoid', marginBottom: 18 }}>
                        <h2 style={{ fontSize: 15, textTransform: 'uppercase', letterSpacing: 1.5, borderBottom: `1.5px solid currentColor`, paddingBottom: 3, marginBottom: 9, fontWeight: 700 }}>
                          {c.name}
                          {c.promo?.active && <span style={{ float: 'right', color: '#dc2626', fontSize: 11 }}>%{Math.round(c.promo.percent)} indirim</span>}
                        </h2>
                        {(c.products ?? []).map((p: any) => {
                          const pp = priceParts(p);
                          return (
                            <div key={p.id} style={{ breakInside: 'avoid', marginBottom: 9 }}>
                              <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                                <span style={{ fontWeight: 700 }}>{p.name}{p.age_restricted ? ' 🔞' : ''}</span>
                                {pp && !priceRow && (
                                  <>
                                    <span style={{ flex: 1, borderBottom: '1px dotted currentColor', opacity: 0.4, transform: 'translateY(-3px)' }} />
                                    <span style={{ fontWeight: 700, whiteSpace: 'nowrap' }}>
                                      {pp.original && <span style={{ textDecoration: 'line-through', opacity: 0.5, marginRight: 5, fontWeight: 400 }}>{pp.original}</span>}
                                      {pp.price}
                                    </span>
                                  </>
                                )}
                              </div>
                              {showDesc && p.description && <div style={{ fontSize: 11, opacity: 0.65, marginTop: 1 }}>{p.description}</div>}
                              {showIng && Array.isArray(p.recipe) && p.recipe.length > 0 && (
                                <div style={{ fontSize: 10.5, opacity: 0.5, marginTop: 1 }}>İçindekiler: {p.recipe.map((r: any) => r.name).join(', ')}</div>
                              )}
                              {pp && priceRow && (
                                <div style={{ fontWeight: 700, fontSize: 12, marginTop: 2 }}>
                                  {pp.original && <span style={{ textDecoration: 'line-through', opacity: 0.5, marginRight: 5, fontWeight: 400 }}>{pp.original}</span>}
                                  {pp.price}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </section>
                    ))}
                  </div>

                  <div style={{ textAlign: 'center', opacity: 0.45, fontSize: 9, marginTop: 24, borderTop: '1px solid currentColor', paddingTop: 8 }}>
                    {venue.name} · ComiQR ile hazırlandı
                  </div>
                </div>
          </div>
        </div>
      </div>
    </AdminShell>
  );
}

/* ---------- small UI helpers ---------- */
function Section({ title, right, children }: { title: string; right?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-line bg-surface p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-xs font-bold uppercase tracking-wide text-muted">{title}</h3>
        {right}
      </div>
      {children}
    </div>
  );
}
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-muted">{label}</span>
      {children}
    </label>
  );
}
function Select({ value, onChange, options, disabled }: { value: string; onChange: (v: string) => void; options: [string, string][]; disabled?: boolean }) {
  return (
    <div className="relative">
      <select value={value} onChange={(e) => onChange(e.target.value)} disabled={disabled} className="w-full appearance-none rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink outline-none focus:border-brand-500 disabled:opacity-50">
        {options.map(([v, l]) => (
          <option key={v} value={v}>{l}</option>
        ))}
      </select>
      <svg viewBox="0 0 24 24" className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6" /></svg>
    </div>
  );
}
function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between py-1.5">
      <span className="text-sm text-ink">{label}</span>
      <button type="button" onClick={() => onChange(!value)} className={`flex h-6 w-11 items-center rounded-full p-0.5 transition ${value ? 'bg-emerald-500' : 'bg-line'}`}>
        <span className={`h-5 w-5 rounded-full bg-white shadow transition ${value ? 'translate-x-5' : ''}`} />
      </button>
    </div>
  );
}
function Choice({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button type="button" onClick={onClick} className={`rounded-xl border px-3 py-2.5 text-sm font-semibold transition ${active ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-line text-muted hover:border-brand-300'}`}>
      {label}
    </button>
  );
}
function Swatches({ colors, value, onChange }: { colors: string[]; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {colors.map((c) => (
        <button
          key={c}
          type="button"
          onClick={() => onChange(c)}
          className={`h-8 w-8 rounded-lg border transition ${value === c ? 'ring-2 ring-brand-500 ring-offset-2' : 'border-line'}`}
          style={{ background: c }}
          aria-label={c}
        />
      ))}
    </div>
  );
}
