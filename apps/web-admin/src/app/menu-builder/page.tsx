'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { AdminShell } from '@/components/AdminShell';
import { ThemeThumb } from '@/components/ThemeThumb';
import { useApi } from '@/lib/useApi';

const CUSTOMER_URL = process.env.NEXT_PUBLIC_CUSTOMER_URL ?? 'http://localhost:3010';
const THEMES: [string, string][] = [
  ['classic', 'Classic'],
  ['flipbook', 'Flipbook'],
  ['modern', 'Modern'],
];
const LANGS: [string, string][] = [
  ['tr', 'Türkçe'],
  ['en', 'English'],
  ['de', 'Deutsch'],
  ['ru', 'Русский'],
  ['ar', 'العربية'],
];
const DEVICES: { key: 'phone' | 'tablet' | 'desktop'; label: string; w: number; h: number }[] = [
  { key: 'phone', label: 'Telefon', w: 390, h: 780 },
  { key: 'tablet', label: 'Tablet', w: 768, h: 900 },
  { key: 'desktop', label: 'Masaüstü', w: 1100, h: 820 },
];

export default function MenuBuilderPage() {
  const { api, me, ready } = useApi();
  const [tenant, setTenant] = useState<any | null>(null);
  const [theme, setTheme] = useState('classic');
  const [lang, setLang] = useState('tr');
  const [device, setDevice] = useState<'phone' | 'tablet' | 'desktop'>('phone');
  const [savingTheme, setSavingTheme] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  const slug = me?.tenant?.slug ?? tenant?.slug;

  useEffect(() => {
    if (!ready) return;
    api.getTenant().then((t) => {
      setTenant(t);
      setTheme(t?.settings?.theme ?? 'classic');
      setLang(t?.locale_default ?? 'tr');
    }).catch(() => undefined);
  }, [ready, api]);

  const menuUrl = slug ? `${CUSTOMER_URL}/v/${slug}` : '';
  const previewUrl = useMemo(() => {
    if (!menuUrl) return '';
    const q = new URLSearchParams({ theme, locale: lang, preview: '1' });
    return `${menuUrl}?${q.toString()}&_=${reloadKey}`;
  }, [menuUrl, theme, lang, reloadKey]);

  async function pickTheme(t: string) {
    setTheme(t);
    setSavingTheme(t);
    try {
      await api.updateTenant({ settings_json: { theme: t } } as any);
    } catch {
      /* preview still updates even if save fails */
    } finally {
      setSavingTheme(null);
    }
  }

  function copyLink() {
    if (!menuUrl) return;
    navigator.clipboard?.writeText(menuUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  const dev = DEVICES.find((d) => d.key === device)!;
  const frameScale = device === 'desktop' ? Math.min(1, 900 / dev.w) : 1;

  return (
    <AdminShell title="Menü Builder">
      <p className="mb-4 text-sm text-muted">Müşterilerinizin QR kodu okuttuğunda göreceği menüyü buradan önizleyin ve tasarlayın.</p>

      <div className="flex flex-col gap-6 lg:flex-row">
        {/* ---------- Left: settings ---------- */}
        <aside className="w-full shrink-0 space-y-5 lg:w-80">
          {/* Link */}
          <Section title="Menü Bağlantısı">
            <div className="flex items-center gap-2 rounded-xl border border-line bg-canvas px-3 py-2">
              <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0 text-muted" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1" /></svg>
              <span className="min-w-0 flex-1 truncate text-sm text-ink">{menuUrl || '…'}</span>
            </div>
            <div className="mt-2 flex gap-2">
              <button type="button" onClick={copyLink} className="flex-1 rounded-lg border border-line py-2 text-sm font-semibold text-ink transition hover:bg-canvas">{copied ? '✓ Kopyalandı' : 'Kopyala'}</button>
              <a href={menuUrl} target="_blank" rel="noopener noreferrer" className="flex-1 rounded-lg border border-line py-2 text-center text-sm font-semibold text-ink transition hover:bg-canvas">Yeni Sekmede Aç</a>
            </div>
            <Link href="/tables" className="mt-2 flex items-center justify-center gap-1.5 rounded-lg bg-brand-500 py-2 text-sm font-bold text-white transition hover:bg-brand-600" style={{ color: '#ffffff' }}>
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round"><path d="M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h3v3h-3zM20 14v3M17 20h3M20 20v1" /></svg>
              QR Kodlarını Al (Masalar & QR)
            </Link>
          </Section>

          {/* Theme */}
          <Section title="Menü Teması">
            <div className="grid grid-cols-3 gap-3">
              {THEMES.map(([val, label]) => (
                <div key={val} className={`overflow-hidden rounded-xl border transition ${theme === val ? 'border-brand-500 ring-2 ring-brand-200' : 'border-line hover:border-brand-300'}`}>
                  <button type="button" onClick={() => pickTheme(val)} className="block w-full bg-canvas p-2" title={`${label} temasını seç`}>
                    <ThemeThumb theme={val} />
                  </button>
                  <div className={`py-1.5 text-center text-xs font-semibold ${theme === val ? 'bg-brand-500 text-white' : 'bg-surface text-muted'}`} style={theme === val ? { color: '#ffffff' } : undefined}>
                    {savingTheme === val ? '…' : label}
                  </div>
                </div>
              ))}
            </div>
            <p className="mt-2 text-[11px] text-muted">Seçtiğiniz tema anında canlı menünüze uygulanır.</p>
          </Section>

          {/* Language */}
          <Section title="Önizleme Dili">
            <div className="relative">
              <select value={lang} onChange={(e) => setLang(e.target.value)} className="w-full appearance-none rounded-lg border border-line bg-white px-3 py-2.5 text-sm text-ink outline-none focus:border-brand-500">
                {LANGS.map(([v, l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </select>
              <svg viewBox="0 0 24 24" className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6" /></svg>
            </div>
          </Section>

          {/* Device */}
          <Section title="Cihaz">
            <div className="grid grid-cols-3 gap-2">
              {DEVICES.map((d) => (
                <button key={d.key} type="button" onClick={() => setDevice(d.key)} className={`rounded-xl border px-2 py-2.5 text-xs font-semibold transition ${device === d.key ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-line text-muted hover:border-brand-300'}`}>
                  {d.label}
                </button>
              ))}
            </div>
          </Section>
        </aside>

        {/* ---------- Right: live QR menu ---------- */}
        <div className="min-w-0 flex-1">
          <div className="mb-3 flex items-center justify-center gap-3">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted">QR Menü Önizleme</span>
            <button type="button" onClick={() => setReloadKey((k) => k + 1)} title="Yenile" className="grid h-8 w-8 place-items-center rounded-lg border border-line text-muted transition hover:bg-canvas">
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 0 1 15-6.7L21 8M21 3v5h-5M21 12a9 9 0 0 1-15 6.7L3 16M3 21v-5h5" /></svg>
            </button>
          </div>

          <div className="grid min-h-[600px] place-items-center overflow-auto rounded-2xl bg-[#eef2f7] p-6">
            {!previewUrl ? (
              <p className="text-sm text-muted">Yükleniyor…</p>
            ) : (
              <div
                className={`relative bg-black shadow-2xl ${device === 'phone' ? 'rounded-[2.2rem] p-2.5' : device === 'tablet' ? 'rounded-[1.6rem] p-3' : 'rounded-xl p-1.5'}`}
                style={{ width: dev.w * frameScale + (device === 'phone' ? 20 : device === 'tablet' ? 24 : 12), transform: device === 'desktop' ? undefined : undefined }}
              >
                {device === 'phone' && <div className="absolute left-1/2 top-2.5 z-10 h-4 w-24 -translate-x-1/2 rounded-full bg-black" />}
                <iframe
                  key={previewUrl}
                  src={previewUrl}
                  title="QR Menü"
                  className={`block bg-white ${device === 'phone' ? 'rounded-[1.7rem]' : device === 'tablet' ? 'rounded-[1rem]' : 'rounded-lg'}`}
                  style={{ width: dev.w, height: dev.h, transform: `scale(${frameScale})`, transformOrigin: 'top left', border: 0, ...(frameScale !== 1 ? { marginRight: dev.w * (1 - frameScale) * -1, marginBottom: dev.h * (1 - frameScale) * -1 } : {}) }}
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </AdminShell>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-line bg-surface p-4">
      <h3 className="mb-3 text-xs font-bold uppercase tracking-wide text-muted">{title}</h3>
      {children}
    </div>
  );
}
