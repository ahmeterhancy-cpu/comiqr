'use client';

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useLocale } from 'next-intl';
import type { AllergenRef, Menu, MenuCategory, MenuModifier, MenuModifierGroup, MenuProduct } from '@comiqr/shared-types';
import { lineKey, useCart, type CartLine } from './cart';

export interface MenuLabels {
  kcal: string;
  protein: string;
  carb: string;
  fat: string;
  contains: string;
  traces: string;
  vegan: string;
  vegetarian: string;
  glutenFree: string;
  estimated: string;
  empty: string;
}

type ThemeProps = {
  menu: Menu;
  labels: MenuLabels;
  tableCode?: string;
  allergenMap: Map<number, AllergenRef>;
  format: Intl.NumberFormat;
  categories: MenuCategory[];
};

/** Public venue menu. The venue's chosen theme picks one of three layouts. */
export function MenuView({ menu, labels, tableCode }: { menu: Menu; labels: MenuLabels; tableCode?: string }) {
  const allergenMap = new Map<number, AllergenRef>(menu.allergens.map((a) => [a.id, a]));
  const format = new Intl.NumberFormat(menu.venue.locale_default ?? 'tr', {
    style: 'currency',
    currency: menu.venue.currency || 'TRY',
    maximumFractionDigits: 0,
  });
  const categories = menu.categories.filter((c) => c.products.length > 0);
  const props: ThemeProps = { menu, labels, tableCode, allergenMap, format, categories };

  const theme = menu.venue.theme ?? 'modern';
  if (theme === 'classic') return <ClassicMenu {...props} />;
  if (theme === 'flipbook') return <FlipbookMenu {...props} />;
  return <ModernMenu {...props} />;
}

/* Turn a stored handle/url into an absolute link (handles bare handles & @-prefixes). */
function normUrl(value: string, base: string, stripAt = false): string {
  const t = value.trim();
  if (/^https?:\/\//i.test(t)) return t;
  return base + (stripAt ? t.replace(/^@+/, '') : t);
}

type WeekHour = { closed: boolean; open: string | null; close: string | null; today: boolean };

function hasWeekHours(hours: Menu['venue']['hours']): hours is WeekHour[] {
  return Array.isArray(hours) && hours.length === 7;
}

/** Localised weekday name; i: 0=Mon..6=Sun (2024-01-01 was a Monday). */
function dayName(i: number, loc: string): string {
  return new Intl.DateTimeFormat(loc || 'tr', { weekday: 'long' }).format(new Date(2024, 0, 1 + i));
}

/** Per-day working-hours table; highlights today (green when open, red when closed now). */
function WeekHours({ hours, loc, openNow }: { hours: WeekHour[]; loc: string; openNow?: boolean | null }) {
  const todayColor = openNow ? 'text-emerald-600' : 'text-red-500';
  return (
    <div className="mt-3 grid grid-cols-1 gap-x-6 gap-y-2 rounded-2xl bg-white px-4 py-3 text-sm shadow-[var(--shadow-card)] sm:grid-cols-2">
      {hours.map((h, i) => (
        <div key={i} className={`flex items-center justify-between gap-3 ${h.today ? 'font-semibold' : ''}`}>
          <span className={h.today ? todayColor : 'text-ink'}>{dayName(i, loc)}</span>
          <span className={h.closed ? 'text-muted' : h.today ? todayColor : 'text-ink'}>
            {h.closed || !h.open || !h.close ? 'Kapalı' : `${h.open} – ${h.close}`}
          </span>
        </div>
      ))}
    </div>
  );
}

type VLink = { key: string; href: string; icon: ReactNode; text?: string; label: string; wide?: boolean };

/** Build the venue's contact + social links (WiFi renders separately). */
function venueLinks(v: Menu['venue']): { info: VLink[]; socials: VLink[] } {
  const igHandle = v.instagram
    ? '@' + v.instagram.replace(/^https?:\/\/(www\.)?instagram\.com\//i, '').replace(/^@+/, '').replace(/\/+$/, '')
    : '';
  const info: VLink[] = []; // links carrying a label (address, instagram handle, email, …)
  const socials: VLink[] = []; // icon-only social buttons
  if (v.address) info.push({ key: 'addr', href: `https://maps.google.com/?q=${encodeURIComponent(v.address)}`, icon: <PinIcon />, text: v.address, label: 'Adres', wide: true });
  if (v.instagram) info.push({ key: 'ig', href: normUrl(v.instagram, 'https://instagram.com/', true), icon: <IgIcon />, text: igHandle, label: 'Instagram' });
  if (v.email) info.push({ key: 'email', href: `mailto:${v.email}`, icon: <MailIcon />, text: v.email, label: 'E-posta' });
  if (v.website) info.push({ key: 'web', href: normUrl(v.website, 'https://'), icon: <GlobeIcon />, text: v.website.replace(/^https?:\/\/(www\.)?/i, '').replace(/\/+$/, ''), label: 'Web sitesi' });
  if (v.phone) info.push({ key: 'phone', href: `tel:${v.phone.replace(/\s+/g, '')}`, icon: <PhoneIcon />, text: v.phone, label: 'Telefon' });
  if (v.whatsapp) socials.push({ key: 'wa', href: `https://wa.me/${v.whatsapp.replace(/[^\d]/g, '')}`, icon: <WaIcon />, label: 'WhatsApp' });
  if (v.facebook) socials.push({ key: 'fb', href: normUrl(v.facebook, 'https://facebook.com/'), icon: <FbIcon />, label: 'Facebook' });
  if (v.x) socials.push({ key: 'x', href: normUrl(v.x, 'https://x.com/', true), icon: <XIcon />, label: 'X' });
  if (v.tiktok) socials.push({ key: 'tt', href: normUrl(v.tiktok, 'https://tiktok.com/@', true), icon: <TtIcon />, label: 'TikTok' });
  if (v.youtube) socials.push({ key: 'yt', href: normUrl(v.youtube, 'https://youtube.com/'), icon: <YtIcon />, label: 'YouTube' });
  return { info, socials };
}

const LOCALES: { code: string; label: string }[] = [
  { code: 'tr', label: 'Türkçe' },
  { code: 'en', label: 'English' },
  { code: 'de', label: 'Deutsch' },
  { code: 'ru', label: 'Русский' },
  { code: 'ar', label: 'العربية' },
];

/** Language picker (cookie-based; refreshes to re-render in the chosen locale). Sits in the cover overlay. */
function LocaleSwitcher() {
  const active = useLocale();
  const [open, setOpen] = useState(false);
  const current = LOCALES.find((l) => l.code === active) ?? LOCALES[1];
  const pick = (code: string) => {
    document.cookie = `locale=${code}; path=/; max-age=31536000; samesite=lax`;
    window.location.reload();
  };
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex items-center gap-1.5 rounded-xl bg-white/95 px-3 py-2 text-sm font-medium text-ink shadow-lg backdrop-blur"
      >
        <GlobeIcon />
        <span>{current.label}</span>
        <ChevronIcon open={open} />
      </button>
      {open && (
        <div className="absolute right-0 z-40 mt-1 w-36 overflow-hidden rounded-xl bg-white py-1 shadow-xl">
          {LOCALES.map((l) => (
            <button
              key={l.code}
              type="button"
              onClick={() => pick(l.code)}
              className={`block w-full px-3 py-2 text-left text-sm ${l.code === active ? 'bg-brand-50 font-semibold text-brand-700' : 'text-ink hover:bg-canvas'}`}
            >
              {l.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** Contact + social links dropdown. Sits in the cover overlay bar. */
function ContactMenu({ v }: { v: Menu['venue'] }) {
  const [open, setOpen] = useState(false);
  const { info, socials } = venueLinks(v);
  if (info.length === 0 && socials.length === 0) return null;
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-label="İletişim"
        className="flex items-center gap-1.5 rounded-xl bg-white/95 px-3 py-2 text-ink shadow-lg backdrop-blur"
      >
        <ContactIcon />
        <ChevronIcon open={open} />
      </button>
      {open && (
        <div className="absolute right-0 z-40 mt-1 w-[min(20rem,calc(100vw-2rem))] space-y-2 rounded-2xl bg-white p-3 shadow-xl">
          {info.length > 0 && (
            <div className="grid grid-cols-2 gap-2">
              {info.map((l) => (
                <a
                  key={l.key}
                  href={l.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={l.label}
                  title={l.label}
                  className={`inline-flex min-w-0 items-center justify-center gap-1.5 rounded-full bg-canvas px-3 py-1.5 text-xs font-medium text-ink transition hover:text-brand-700 ${
                    l.wide ? 'col-span-2' : ''
                  }`}
                >
                  <span className="shrink-0 text-brand-600">{l.icon}</span>
                  {l.text && <span className="truncate">{l.text}</span>}
                </a>
              ))}
            </div>
          )}
          {socials.length > 0 && (
            <div className="flex flex-wrap items-center justify-center gap-2">
              {socials.map((l) => (
                <a
                  key={l.key}
                  href={l.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={l.label}
                  title={l.label}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-canvas text-brand-600 transition hover:text-brand-700"
                >
                  {l.icon}
                </a>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/** Guest WiFi chip — always visible under the header. */
function WifiChip({ v }: { v: Menu['venue'] }) {
  const [showPw, setShowPw] = useState(false);
  if (!(v.wifi_ssid && v.wifi_ssid.trim())) return null;
  return (
    <div className="mx-auto mt-3 flex w-full max-w-sm items-center justify-center gap-2 rounded-full bg-white px-3.5 py-2 text-xs text-ink shadow-[var(--shadow-card)]">
      <span className="text-brand-600"><WifiIcon /></span>
      <span className="font-semibold">{v.wifi_ssid}</span>
      {v.wifi_password && (
        <>
          <span className="text-muted"><LockIcon /></span>
          <span className="font-mono tracking-wide">{showPw ? v.wifi_password : '••••••••'}</span>
          <button
            type="button"
            onClick={() => setShowPw((p) => !p)}
            aria-label={showPw ? 'Şifreyi gizle' : 'Şifreyi göster'}
            className="text-muted transition hover:text-ink"
          >
            {showPw ? <EyeOffIcon /> : <EyeIcon />}
          </button>
        </>
      )}
    </div>
  );
}

const SERVICE_API = process.env.NEXT_PUBLIC_API_URL ?? 'http://127.0.0.1:8000/v1';

/** Call waiter / request bill from the slug menu — customer picks their table code. */
function ServiceCall({ slug, tables }: { slug: string; tables: string[] }) {
  const [mode, setMode] = useState<null | 'call-waiter' | 'request-bill'>(null);
  const [table, setTable] = useState<string>(tables[0] ?? '');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const title = mode === 'request-bill' ? 'Hesap İste' : 'Garson Çağır';

  const submit = async () => {
    if (!table || !mode) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`${SERVICE_API}/service/${mode}?tenant=${encodeURIComponent(slug)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ table }),
      });
      if (!res.ok) throw new Error();
      setDone(`${mode === 'request-bill' ? 'Hesap istendi' : 'Garson çağrıldı'} · Masa ${table}`);
      setMode(null);
      setTimeout(() => setDone(null), 4000);
    } catch {
      setError('Gönderilemedi, tekrar deneyin.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className="mx-auto mt-3 grid max-w-sm grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => { setMode('call-waiter'); setError(null); }}
          className="flex w-full items-center justify-center gap-1.5 rounded-full bg-white px-3 py-2 text-sm font-semibold text-ink shadow-[var(--shadow-card)] transition hover:text-brand-700"
        >
          <BellIcon /> Garson Çağır
        </button>
        <button
          type="button"
          onClick={() => { setMode('request-bill'); setError(null); }}
          className="flex w-full items-center justify-center gap-1.5 rounded-full bg-white px-3 py-2 text-sm font-semibold text-ink shadow-[var(--shadow-card)] transition hover:text-brand-700"
        >
          <ReceiptIcon /> Hesap İste
        </button>
      </div>
      {done && <p className="mx-auto mt-2 max-w-sm text-center text-xs font-semibold text-emerald-600">✓ {done}</p>}

      {mode && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center"
          onClick={() => !busy && setMode(null)}
        >
          <div className="w-full max-w-sm rounded-2xl bg-canvas p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-base font-bold text-ink">{title}</h3>
            <p className="mt-0.5 text-sm text-muted">Lütfen masanızı seçin</p>
            <label className="mt-3 block">
              <span className="mb-1 block text-xs font-medium text-muted">Masa</span>
              <select
                value={table}
                onChange={(e) => setTable(e.target.value)}
                className="w-full rounded-lg border border-line bg-white px-3 py-2 text-sm outline-none focus:border-brand-500"
              >
                {tables.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </label>
            {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={() => setMode(null)}
                disabled={busy}
                className="flex-1 rounded-lg border border-line py-2 text-sm font-semibold text-muted"
              >
                Vazgeç
              </button>
              <button
                type="button"
                onClick={submit}
                disabled={busy || !table}
                className="flex-1 rounded-lg bg-brand-500 py-2 text-sm font-semibold"
                style={{ color: '#ffffff' }}
              >
                {busy ? 'Gönderiliyor…' : title}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function BellIcon() { return (<svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.7 21a2 2 0 0 1-3.4 0" /></svg>); }
function ReceiptIcon() { return (<svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"><path d="M5 3v18l2-1 2 1 2-1 2 1 2-1 2 1V3l-2 1-2-1-2 1-2-1-2 1z" /><path d="M9 8h6M9 12h6" strokeLinecap="round" /></svg>); }
function ContactIcon() { return (<svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H8l-4 4V5a2 2 0 0 1 2-2h13a2 2 0 0 1 2 2z" /></svg>); }
function ClockIcon() { return (<svg viewBox="0 0 24 24" className="h-3.5 w-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>); }
function PinIcon() { return (<svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"><path d="M12 21s-6-5.3-6-10a6 6 0 1 1 12 0c0 4.7-6 10-6 10z" /><circle cx="12" cy="11" r="2" /></svg>); }
function ChevronIcon({ open }: { open: boolean }) { return (<svg viewBox="0 0 24 24" className={`h-3.5 w-3.5 text-muted transition-transform ${open ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6" /></svg>); }
function IgIcon() { return (<svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="5" /><circle cx="12" cy="12" r="4" /><circle cx="17" cy="7" r="1" fill="currentColor" stroke="none" /></svg>); }
function MailIcon() { return (<svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3 7 9 6 9-6" /></svg>); }
function GlobeIcon() { return (<svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3c2.5 2.5 2.5 15 0 18M12 3c-2.5 2.5-2.5 15 0 18" /></svg>); }
function PhoneIcon() { return (<svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"><path d="M5 3h4l2 5-3 2a12 12 0 0 0 5 5l2-3 5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 5a2 2 0 0 1 2-2z" /></svg>); }
function WaIcon() { return (<svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor"><path d="M12 2a10 10 0 0 0-8.6 15L2 22l5.1-1.3A10 10 0 1 0 12 2zm0 2a8 8 0 1 1-4.1 14.9l-.3-.2-2.8.8.8-2.7-.2-.3A8 8 0 0 1 12 4zm-2.7 4.3c-.2 0-.5.1-.7.4-.3.3-.9.9-.9 2.1s.9 2.4 1 2.6c.1.2 1.7 2.7 4.2 3.7 2.1.8 2.5.7 3 .6.5-.1 1.5-.6 1.7-1.2.2-.6.2-1.1.1-1.2 0-.1-.2-.2-.5-.3l-1.7-.8c-.2-.1-.4-.1-.6.1l-.6.8c-.1.1-.3.2-.5.1-.7-.3-1.4-.6-2.1-1.6-.2-.3.2-.5.4-.8.1-.2 0-.4 0-.5l-.7-1.7c-.2-.4-.3-.3-.5-.3z" /></svg>); }
function FbIcon() { return (<svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor"><path d="M13 22v-8h2.6l.4-3H13V9.2c0-.9.3-1.5 1.6-1.5H16V5.1c-.3 0-1.2-.1-2.2-.1-2.2 0-3.8 1.4-3.8 3.9V11H7.5v3H10v8h3z" /></svg>); }
function XIcon() { return (<svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor"><path d="M17.5 3h3l-6.6 7.5L21.5 21h-5.8l-4.5-5.9L5.9 21H2.8l7-8L2.5 3h5.9l4.1 5.4L17.5 3zm-2 16h1.6L8.5 4.7H6.8L15.5 19z" /></svg>); }
function TtIcon() { return (<svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor"><path d="M14 3c.3 2.1 1.6 3.6 3.7 3.9v2.4c-1.3.1-2.5-.3-3.7-1v5.4c0 3-2.1 5.3-5 5.3a4.9 4.9 0 0 1-5-4.9c0-2.9 2.4-5 5.3-4.8v2.5c-.3-.1-.7-.2-1-.2-1.3 0-2.3 1-2.3 2.4 0 1.3 1 2.4 2.3 2.4 1.4 0 2.4-1.1 2.4-2.6V3H14z" /></svg>); }
function YtIcon() { return (<svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor"><path d="M22 8.2a2.6 2.6 0 0 0-1.8-1.8C18.6 6 12 6 12 6s-6.6 0-8.2.4A2.6 2.6 0 0 0 2 8.2 27 27 0 0 0 1.6 12 27 27 0 0 0 2 15.8a2.6 2.6 0 0 0 1.8 1.8C5.4 18 12 18 12 18s6.6 0 8.2-.4a2.6 2.6 0 0 0 1.8-1.8A27 27 0 0 0 22.4 12 27 27 0 0 0 22 8.2zM10 15V9l5.2 3L10 15z" /></svg>); }
function WifiIcon() { return (<svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M5 12.5a10 10 0 0 1 14 0M8 15.5a6 6 0 0 1 8 0" /><circle cx="12" cy="19" r="1" fill="currentColor" stroke="none" /></svg>); }
function LockIcon() { return (<svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2"><rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></svg>); }
function EyeIcon() { return (<svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" /><circle cx="12" cy="12" r="3" /></svg>); }
function EyeOffIcon() { return (<svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M3 3l18 18M10.6 10.6a3 3 0 0 0 4.2 4.2M9.9 5.2A9.5 9.5 0 0 1 12 5c6.5 0 10 7 10 7a17 17 0 0 1-3.3 4M6.1 6.1A17 17 0 0 0 2 12s3.5 7 10 7a9.5 9.5 0 0 0 3.9-.8" /></svg>); }

/* ------------------------------------------------------------------ Modern */
/* Card list with full nutrition + a sticky category nav (the default). */

function ModernMenu({ menu, labels, tableCode, allergenMap, format, categories }: ThemeProps) {
  const v = menu.venue;
  const loc = v.locale_default ?? 'tr';
  const cart = useCart(v.slug ?? '');
  const [optionsProduct, setOptionsProduct] = useState<MenuProduct | null>(null);
  const [detailProduct, setDetailProduct] = useState<MenuProduct | null>(null);
  const [hoursOpen, setHoursOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [fAllergen, setFAllergen] = useState(false);
  const [fGluten, setFGluten] = useState(false);
  const [fLactose, setFLactose] = useState(false);

  const glutenId = useMemo(() => menu.allergens.find((a) => /glu/i.test(a.code) || /gluten/i.test(a.name))?.id ?? null, [menu.allergens]);
  const lactoseId = useMemo(
    () => menu.allergens.find((a) => /lac|milk|dairy|sut/i.test(a.code) || /lakto|süt/i.test(a.name))?.id ?? null,
    [menu.allergens],
  );

  const visible = useMemo(() => {
    const q = search.trim().toLocaleLowerCase(loc);
    if (!q && !fAllergen && !fGluten && !fLactose) return categories;
    return categories
      .map((c) => ({
        ...c,
        products: c.products.filter((p) => {
          if (q && !p.name.toLocaleLowerCase(loc).includes(q) && !(p.description ?? '').toLocaleLowerCase(loc).includes(q)) return false;
          const contains = p.nutrition?.allergens?.contains ?? [];
          if (fAllergen && contains.length > 0) return false;
          if (fGluten && glutenId != null && contains.includes(glutenId)) return false;
          if (fLactose && lactoseId != null && contains.includes(lactoseId)) return false;
          return true;
        }),
      }))
      .filter((c) => c.products.length > 0);
  }, [categories, search, fAllergen, fGluten, fLactose, glutenId, lactoseId, loc]);

  // Sticky category cards track the section in view and auto-centre the active card.
  const navRef = useRef<HTMLElement | null>(null);
  const cardRefs = useRef(new Map<number, HTMLElement>());
  const [activeCat, setActiveCat] = useState<number | null>(categories[0]?.id ?? null);

  useEffect(() => {
    if (categories.length <= 1) return;
    let raf = 0;
    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        const triggerY = (navRef.current?.getBoundingClientRect().bottom ?? 0) + 8;
        let cur = categories[0].id;
        for (const c of categories) {
          const el = document.getElementById(`cat-${c.id}`);
          if (el && el.getBoundingClientRect().top <= triggerY) cur = c.id;
        }
        setActiveCat((p) => (p === cur ? p : cur));
      });
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [categories]);

  useEffect(() => {
    if (activeCat == null) return;
    const nav = navRef.current;
    const card = cardRefs.current.get(activeCat);
    if (!nav || !card) return;
    const nr = nav.getBoundingClientRect();
    const cr = card.getBoundingClientRect();
    const delta = cr.left - nr.left - (nav.clientWidth - card.clientWidth) / 2;
    if (Math.abs(delta) > 4) nav.scrollTo({ left: nav.scrollLeft + delta });
  }, [activeCat]);

  return (
    <div className="mx-auto max-w-2xl pb-16">
      {/* Nameless-style header: cover on top (with language + contact overlay), then logo + name + status + hours */}
      <header className="bg-gradient-to-b from-brand-50/70 to-canvas pb-5">
        {v.cover ? (
          <div className="relative">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={v.cover} alt={v.name} className="h-60 w-full rounded-b-3xl object-cover sm:h-80" />
            <div className="absolute inset-x-0 top-0 flex items-start justify-end gap-2 p-3">
              <LocaleSwitcher />
              <ContactMenu v={v} />
            </div>
          </div>
        ) : (
          <div className="flex items-start justify-end gap-2 px-5 pt-4">
            <LocaleSwitcher />
            <ContactMenu v={v} />
          </div>
        )}
        <div className="px-5 pt-4">
          <div className="flex items-center gap-3 text-left">
            {v.logo && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={v.logo}
                alt={v.name}
                className="h-16 w-16 shrink-0 rounded-2xl border border-line bg-white object-cover shadow-[var(--shadow-card)]"
              />
            )}
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <h1 className="text-xl font-extrabold tracking-tight text-ink">{v.name}</h1>
                {v.open_now != null &&
                  (hasWeekHours(v.hours) ? (
                    <button
                      type="button"
                      onClick={() => setHoursOpen((o) => !o)}
                      aria-expanded={hoursOpen}
                      className={`inline-flex items-center gap-1.5 text-sm font-semibold ${v.open_now ? 'text-emerald-600' : 'text-red-500'}`}
                    >
                      <span className={`h-2 w-2 rounded-full ${v.open_now ? 'bg-emerald-500' : 'bg-red-500'}`} />
                      {v.open_now ? 'Açık' : 'Kapalı'}
                      <ChevronIcon open={hoursOpen} />
                    </button>
                  ) : (
                    <span className={`inline-flex items-center gap-1.5 text-sm font-semibold ${v.open_now ? 'text-emerald-600' : 'text-red-500'}`}>
                      <span className={`h-2 w-2 rounded-full ${v.open_now ? 'bg-emerald-500' : 'bg-red-500'}`} />
                      {v.open_now ? 'Açık' : 'Kapalı'}
                    </span>
                  ))}
                {tableCode && <span className="rounded-full bg-brand-500 px-2.5 py-0.5 text-xs font-semibold text-white">{tableCode}</span>}
              </div>
              {v.sub_title && <p className="mt-0.5 truncate text-sm text-muted">{v.sub_title}</p>}
              {!hasWeekHours(v.hours) && v.timing && (
                <p className="mt-1 flex items-center gap-1.5 text-xs text-muted">
                  <ClockIcon />
                  <span>{v.timing}</span>
                </p>
              )}
            </div>
          </div>
          {hoursOpen && hasWeekHours(v.hours) && <WeekHours hours={v.hours!} loc={loc} openNow={v.open_now} />}
          <WifiChip v={v} />
          {v.allow_call_waiter && v.slug && (menu.tables?.length ?? 0) > 0 && <ServiceCall slug={v.slug} tables={menu.tables!} />}
        </div>
      </header>

      {/* Category image cards — sticky, scroll-spy highlights & centres the active one */}
      {categories.length > 1 && (
        <nav
          ref={navRef}
          className="no-scrollbar sticky top-0 z-30 flex gap-3 overflow-x-auto border-b border-line bg-canvas/95 px-4 py-3 backdrop-blur"
        >
          {categories.map((c) => {
            const img = c.image_path || c.products?.[0]?.images?.[0];
            const active = activeCat === c.id;
            return (
              <a
                key={c.id}
                href={`#cat-${c.id}`}
                ref={(el) => {
                  if (el) cardRefs.current.set(c.id, el);
                  else cardRefs.current.delete(c.id);
                }}
                className={`relative aspect-[5/4] w-28 shrink-0 overflow-hidden rounded-2xl shadow-[var(--shadow-card)] transition ${
                  active ? 'ring-2 ring-brand-500 ring-offset-2 ring-offset-canvas' : ''
                }`}
              >
                {img ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={img} alt={c.name} className="absolute inset-0 h-full w-full object-cover" />
                ) : (
                  <div className="absolute inset-0 bg-gradient-to-br from-brand-500 to-brand-700" />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/25 to-transparent" />
                <span className="absolute inset-0 flex items-center justify-center px-2 text-center text-sm font-extrabold leading-tight text-white [text-shadow:0_2px_10px_rgba(0,0,0,0.55)]">
                  {c.name}
                </span>
              </a>
            );
          })}
        </nav>
      )}

      {/* Search + allergen filters */}
      <div className="flex flex-col gap-2 px-4 pb-1 pt-3 sm:flex-row sm:items-center">
        <div className="flex flex-1 items-center gap-2 rounded-xl border border-line bg-white px-3.5 py-2.5">
          <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0 text-muted" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3-3" strokeLinecap="round" />
          </svg>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search..."
            className="w-full bg-transparent text-sm text-ink outline-none placeholder:text-muted"
          />
          {search && (
            <button onClick={() => setSearch('')} aria-label="Temizle" className="shrink-0 text-muted transition hover:text-ink">
              ✕
            </button>
          )}
        </div>
        <div className="no-scrollbar flex items-center gap-2 overflow-x-auto">
          <FilterChip active={fAllergen} onClick={() => setFAllergen((x) => !x)} tone="red">⚠️ Allergen</FilterChip>
          <FilterChip active={fGluten} onClick={() => setFGluten((x) => !x)} tone="amber">🌾 Gluten</FilterChip>
          <FilterChip active={fLactose} onClick={() => setFLactose((x) => !x)} tone="sky">🥛 Lactose</FilterChip>
        </div>
      </div>

      {visible.length === 0 ? (
        <p className="px-5 py-16 text-center text-sm text-muted">
          {search ? `“${search}” için sonuç bulunamadı.` : labels.empty}
        </p>
      ) : (
        visible.map((c) => (
          <section key={c.id} id={`cat-${c.id}`} className="scroll-mt-32 px-4 pt-6">
            <h2 className="mb-3 px-1 text-[13px] font-bold uppercase tracking-wider text-brand-700">{c.name}</h2>
            <div className="space-y-3">
              {c.products.map((p) => {
                const baseKey = lineKey(p.id, undefined, []);
                return (
                  <ModernProduct
                    key={p.id}
                    product={p}
                    allergenMap={allergenMap}
                    labels={labels}
                    format={format}
                    canOrder={!!v.can_order}
                    baseQty={cart.qtyOfKey(baseKey)}
                    productQty={cart.qtyOfProduct(p.id)}
                    onQuick={(q) =>
                      cart.setQty(
                        { key: baseKey, id: p.id, name: p.name, price: Number(p.price), variantId: undefined, variantName: undefined, modifierIds: [], modifierNames: [] },
                        q,
                      )
                    }
                    onOptions={() => setOptionsProduct(p)}
                    onDetail={() => setDetailProduct(p)}
                  />
                );
              })}
            </div>
          </section>
        ))
      )}
      {detailProduct && (
        <ProductDetailSheet
          product={detailProduct}
          format={format}
          allergenMap={allergenMap}
          labels={labels}
          canOrder={!!v.can_order}
          baseQty={cart.qtyOfKey(lineKey(detailProduct.id, undefined, []))}
          productQty={cart.qtyOfProduct(detailProduct.id)}
          onQuick={(q) =>
            cart.setQty(
              {
                key: lineKey(detailProduct.id, undefined, []),
                id: detailProduct.id,
                name: detailProduct.name,
                price: Number(detailProduct.price),
                variantId: undefined,
                variantName: undefined,
                modifierIds: [],
                modifierNames: [],
              },
              q,
            )
          }
          onOptions={() => {
            setOptionsProduct(detailProduct);
            setDetailProduct(null);
          }}
          onClose={() => setDetailProduct(null)}
        />
      )}
      {optionsProduct && (
        <ProductOptionsSheet
          product={optionsProduct}
          format={format}
          currentQty={(key) => cart.qtyOfKey(key)}
          onClose={() => setOptionsProduct(null)}
          onAdd={(line) => {
            cart.setQty(line, cart.qtyOfKey(line.key) + 1);
            setOptionsProduct(null);
          }}
        />
      )}
    </div>
  );
}

function ModernProduct({
  product,
  allergenMap,
  labels,
  format,
  canOrder,
  baseQty,
  productQty,
  onQuick,
  onOptions,
  onDetail,
}: {
  product: MenuProduct;
  allergenMap: Map<number, AllergenRef>;
  labels: MenuLabels;
  format: Intl.NumberFormat;
  canOrder?: boolean;
  baseQty?: number;
  productQty?: number;
  onQuick?: (qty: number) => void;
  onOptions?: () => void;
  onDetail?: () => void;
}) {
  const n = product.nutrition;
  const img = product.images?.[0];
  const contains = (n?.allergens.contains ?? []).map((id) => allergenMap.get(id)?.name).filter(Boolean);
  const hasOptions = (product.variants?.length ?? 0) > 0 || (product.modifier_groups?.length ?? 0) > 0;
  const base = baseQty ?? 0;
  const total = productQty ?? 0;

  return (
    <article
      onClick={onDetail}
      className="flex cursor-pointer gap-4 rounded-2xl border border-line bg-surface p-3.5 shadow-[var(--shadow-card)] transition hover:border-brand-300"
    >
      {img && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={img} alt={product.name} className="h-20 w-20 shrink-0 self-start rounded-2xl object-cover sm:h-24 sm:w-24" />
      )}
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-start justify-between gap-3">
          <h3 className="font-bold leading-tight text-ink">
            {product.name}
            {product.age_restricted && (
              <span className="ml-1.5 rounded border border-red-500 px-1 align-middle text-[10px] font-bold text-red-600">18+</span>
            )}
          </h3>
          <div className="shrink-0 font-extrabold text-ink">{format.format(Number(product.price))}</div>
        </div>
        {product.description && <p className="mt-1 line-clamp-2 text-[13px] leading-snug text-muted">{product.description}</p>}
        <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
          {n && (
            <span className="rounded-full bg-brand-50 px-2 py-0.5 text-[11px] font-semibold text-brand-700">
              {Math.round(n.kcal)} {labels.kcal}
            </span>
          )}
          {n?.diet.vegan && <Diet label={labels.vegan} />}
          {n && !n.diet.vegan && n.diet.vegetarian && <Diet label={labels.vegetarian} />}
          {n?.diet.gluten_free && <Diet label={labels.glutenFree} />}
          {contains.length > 0 && (
            <span className="w-full text-[11px] text-muted">
              {labels.contains}: {contains.join(', ')}
            </span>
          )}
        </div>
        {canOrder && (
          <div className="mt-3 flex items-end justify-end" onClick={(e) => e.stopPropagation()}>
            {!hasOptions && onQuick ? (
              base === 0 ? (
                <button
                  type="button"
                  onClick={() => onQuick(1)}
                  className="inline-flex items-center gap-1 rounded-full bg-brand-500 px-4 py-1.5 text-sm font-semibold"
                  style={{ color: '#ffffff' }}
                >
                  <PlusIcon /> Ekle
                </button>
              ) : (
                <div className="inline-flex items-center gap-2 rounded-full bg-brand-500 px-1.5 py-1" style={{ color: '#ffffff' }}>
                  <button type="button" onClick={() => onQuick(base - 1)} aria-label="Azalt" className="grid h-7 w-7 place-items-center rounded-full bg-white/20 text-sm font-bold">−</button>
                  <span className="min-w-5 text-center text-sm font-bold">{base}</span>
                  <button type="button" onClick={() => onQuick(base + 1)} aria-label="Artır" className="grid h-7 w-7 place-items-center rounded-full bg-white/20 text-sm font-bold">+</button>
                </div>
              )
            ) : hasOptions && onOptions ? (
              <button
                type="button"
                onClick={onOptions}
                className="relative inline-flex items-center gap-1 rounded-full bg-brand-500 px-4 py-1.5 text-sm font-semibold"
                style={{ color: '#ffffff' }}
              >
                <PlusIcon /> Ekle
                {total > 0 && (
                  <span className="absolute -right-1.5 -top-1.5 grid h-5 min-w-5 place-items-center rounded-full border-2 border-surface bg-red-500 px-1 text-[11px] font-bold" style={{ color: '#ffffff' }}>
                    {total}
                  </span>
                )}
              </button>
            ) : null}
          </div>
        )}
      </div>
    </article>
  );
}

function PlusIcon() { return (<svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>); }

/** Bottom-sheet to pick a product's variant + modifiers before adding to cart. */
function ProductOptionsSheet({
  product,
  format,
  currentQty,
  onClose,
  onAdd,
}: {
  product: MenuProduct;
  format: Intl.NumberFormat;
  currentQty: (key: string) => number;
  onClose: () => void;
  onAdd: (line: Omit<CartLine, 'qty'>) => void;
}) {
  const variants = product.variants ?? [];
  const groups: MenuModifierGroup[] = product.modifier_groups ?? [];
  const [variantId, setVariantId] = useState<number | undefined>(variants.find((v) => v.is_default)?.id ?? variants[0]?.id);
  const [selected, setSelected] = useState<Record<number, number[]>>({});

  const variant = variants.find((v) => v.id === variantId);
  const chosen = groups.flatMap((g) =>
    (selected[g.id] ?? []).map((id) => g.modifiers.find((m) => m.id === id)).filter(Boolean),
  ) as MenuModifier[];
  const modifierIds = chosen.map((m) => m.id);
  const unitPrice = Number(product.price) + Number(variant?.price_delta ?? 0) + chosen.reduce((s, m) => s + Number(m.price_delta), 0);
  const missingRequired = groups.some((g) => (selected[g.id] ?? []).length < (g.is_required ? Math.max(1, g.min_select) : g.min_select));
  const inCart = currentQty(lineKey(product.id, variantId, modifierIds));

  function toggle(g: MenuModifierGroup, id: number) {
    setSelected((prev) => {
      const cur = prev[g.id] ?? [];
      let next: number[];
      if (g.max_select <= 1) next = cur.includes(id) ? (g.is_required ? cur : []) : [id];
      else if (cur.includes(id)) next = cur.filter((x) => x !== id);
      else if (cur.length < g.max_select) next = [...cur, id];
      else next = cur;
      return { ...prev, [g.id]: next };
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center" onClick={onClose}>
      <div className="max-h-[88vh] w-full max-w-md overflow-hidden rounded-t-3xl bg-canvas sm:rounded-3xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3 border-b border-line px-5 py-4">
          <div className="min-w-0">
            <h3 className="text-base font-bold text-ink">{product.name}</h3>
            {product.description && <p className="mt-0.5 line-clamp-2 text-xs text-muted">{product.description}</p>}
          </div>
          <button type="button" onClick={onClose} aria-label="Kapat" className="shrink-0 text-muted hover:text-ink">
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="m6 6 12 12M18 6 6 18" /></svg>
          </button>
        </div>

        <div className="max-h-[55vh] space-y-4 overflow-y-auto px-5 py-4">
          {variants.length > 0 && (
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Seçenek</p>
              <div className="flex flex-wrap gap-2">
                {variants.map((vr) => (
                  <button
                    key={vr.id}
                    type="button"
                    onClick={() => setVariantId(vr.id)}
                    className={`rounded-full px-3.5 py-1.5 text-sm font-medium ${vr.id === variantId ? 'bg-brand-500' : 'border border-line text-muted'}`}
                    style={vr.id === variantId ? { color: '#ffffff' } : undefined}
                  >
                    {vr.name}
                    {Number(vr.price_delta) ? ` +${format.format(Number(vr.price_delta))}` : ''}
                  </button>
                ))}
              </div>
            </div>
          )}

          {groups.map((g) => (
            <div key={g.id}>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">
                {g.name} {g.is_required && <span className="text-red-500">*</span>}
                {g.max_select > 1 && <span className="ml-1 normal-case text-[11px] font-normal">(en fazla {g.max_select})</span>}
              </p>
              <div className="flex flex-wrap gap-2">
                {g.modifiers.map((m) => {
                  const on = (selected[g.id] ?? []).includes(m.id);
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => toggle(g, m.id)}
                      className={`rounded-full px-3.5 py-1.5 text-sm font-medium ${on ? 'bg-brand-500' : 'border border-line text-muted'}`}
                      style={on ? { color: '#ffffff' } : undefined}
                    >
                      {m.name}
                      {Number(m.price_delta) ? ` +${format.format(Number(m.price_delta))}` : ''}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        <div className="border-t border-line px-5 py-4">
          {missingRequired && <p className="mb-2 text-center text-xs text-red-500">Lütfen zorunlu (*) seçimleri yapın</p>}
          <button
            type="button"
            disabled={missingRequired}
            onClick={() =>
              onAdd({
                key: lineKey(product.id, variantId, modifierIds),
                id: product.id,
                name: product.name,
                variantId,
                variantName: variant?.name,
                modifierIds,
                modifierNames: chosen.map((m) => m.name),
                price: unitPrice,
              })
            }
            className="flex w-full items-center justify-between rounded-xl bg-brand-500 px-5 py-3 text-sm font-bold disabled:opacity-40"
            style={{ color: '#ffffff' }}
          >
            <span>Sepete Ekle{inCart > 0 ? ` · sepette ${inCart}` : ''}</span>
            <span>{format.format(unitPrice)}</span>
          </button>
        </div>
      </div>
    </div>
  );
}

/** Product detail modal — image, allergens, description, ingredient recipe (name + grams), price + add. */
function ProductDetailSheet({
  product,
  format,
  allergenMap,
  labels,
  canOrder,
  baseQty,
  productQty,
  onQuick,
  onOptions,
  onClose,
}: {
  product: MenuProduct;
  format: Intl.NumberFormat;
  allergenMap: Map<number, AllergenRef>;
  labels: MenuLabels;
  canOrder?: boolean;
  baseQty?: number;
  productQty?: number;
  onQuick?: (qty: number) => void;
  onOptions?: () => void;
  onClose: () => void;
}) {
  const n = product.nutrition;
  const img = product.images?.[0];
  const allergens = (n?.allergens.contains ?? []).map((id) => allergenMap.get(id)).filter(Boolean) as AllergenRef[];
  const recipe = product.recipe ?? [];
  const hasOptions = (product.variants?.length ?? 0) > 0 || (product.modifier_groups?.length ?? 0) > 0;
  const base = baseQty ?? 0;
  const total = productQty ?? 0;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center" onClick={onClose}>
      <div className="flex max-h-[92vh] w-full max-w-md flex-col overflow-hidden rounded-t-3xl bg-canvas sm:rounded-3xl" onClick={(e) => e.stopPropagation()}>
        <div className="relative shrink-0">
          {img ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={img} alt={product.name} className="h-56 w-full object-cover" />
          ) : (
            <div className="h-20 w-full bg-gradient-to-br from-brand-500 to-brand-700" />
          )}
          <button
            type="button"
            onClick={onClose}
            aria-label="Kapat"
            className="absolute right-3 top-3 grid h-9 w-9 place-items-center rounded-full bg-white/95 text-ink shadow-lg backdrop-blur"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="m6 6 12 12M18 6 6 18" /></svg>
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          <h2 className="text-xl font-extrabold text-ink">
            {product.name}
            {product.age_restricted && <span className="ml-2 rounded border border-red-500 px-1 align-middle text-[11px] font-bold text-red-600">18+</span>}
          </h2>

          {(allergens.length > 0 || n) && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {n && (
                <span className="rounded-full bg-brand-50 px-2.5 py-1 text-xs font-semibold text-brand-700">
                  {Math.round(n.kcal)} {labels.kcal}
                </span>
              )}
              {n?.diet.vegan && <Diet label={labels.vegan} />}
              {n && !n.diet.vegan && n.diet.vegetarian && <Diet label={labels.vegetarian} />}
              {n?.diet.gluten_free && <Diet label={labels.glutenFree} />}
              {allergens.map((a) => (
                <span key={a.id} className="inline-flex items-center gap-1 rounded-full border border-red-200 bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-600">
                  {a.icon && <span>{a.icon}</span>}
                  {a.name}
                </span>
              ))}
            </div>
          )}

          {product.description && <p className="mt-3 text-sm leading-relaxed text-muted">{product.description}</p>}

          {recipe.length > 0 && (
            <div className="mt-4">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">İçindekiler</p>
              <div className="flex flex-wrap gap-1.5">
                {recipe.map((r, i) => (
                  <span key={i} className="inline-flex items-center gap-1.5 rounded-full border border-line bg-white px-3 py-1.5 text-xs text-ink">
                    <span className="font-medium">{r.name}</span>
                    <span className="text-muted">
                      {fmtAmount(r.quantity)} {r.unit}
                    </span>
                  </span>
                ))}
              </div>
            </div>
          )}

          {n && (
            <div className="mt-4 grid grid-cols-3 gap-2 text-center">
              <NutBox v={Math.round(n.macros.protein_g)} label={labels.protein} />
              <NutBox v={Math.round(n.macros.carb_g)} label={labels.carb} />
              <NutBox v={Math.round(n.macros.fat_g)} label={labels.fat} />
            </div>
          )}
        </div>

        {canOrder && (
          <div className="shrink-0 border-t border-line px-5 py-4">
            <div className="mb-2.5 flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wide text-muted">Fiyat</span>
              <span className="text-lg font-extrabold text-ink">{format.format(Number(product.price))}</span>
            </div>
            {hasOptions && onOptions ? (
              <button type="button" onClick={onOptions} className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-brand-500 py-3 text-sm font-bold" style={{ color: '#ffffff' }}>
                <PlusIcon /> Seçenekleri Seç{total > 0 ? ` · sepette ${total}` : ''}
              </button>
            ) : onQuick ? (
              base === 0 ? (
                <button type="button" onClick={() => onQuick(1)} className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-brand-500 py-3 text-sm font-bold" style={{ color: '#ffffff' }}>
                  <PlusIcon /> Sepete Ekle
                </button>
              ) : (
                <div className="flex items-center justify-between rounded-xl bg-brand-500 px-2 py-2" style={{ color: '#ffffff' }}>
                  <button type="button" onClick={() => onQuick(base - 1)} aria-label="Azalt" className="grid h-9 w-9 place-items-center rounded-lg bg-white/20 text-lg font-bold">−</button>
                  <span className="text-base font-bold">{base}</span>
                  <button type="button" onClick={() => onQuick(base + 1)} aria-label="Artır" className="grid h-9 w-9 place-items-center rounded-lg bg-white/20 text-lg font-bold">+</button>
                </div>
              )
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}

function NutBox({ v, label }: { v: number; label: string }) {
  return (
    <div className="rounded-xl bg-white py-2 shadow-[var(--shadow-card)]">
      <div className="text-sm font-bold text-ink">{v}g</div>
      <div className="text-[10px] uppercase text-muted">{label}</div>
    </div>
  );
}

function fmtAmount(q: number): string {
  return Number.isInteger(q) ? String(q) : String(Number(q.toFixed(2)));
}

/* ----------------------------------------------------------------- Classic */
/* Image-forward: cover hero + logo + about, product photos in each card. */

function ClassicMenu({ menu, labels, format, categories }: ThemeProps) {
  const v = menu.venue;
  return (
    <div className="mx-auto max-w-2xl pb-16">
      <header className="relative overflow-hidden">
        <div className="relative h-52 bg-brand-600">
          {v.cover && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={v.cover} alt="" className="h-full w-full object-cover" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-black/10" />
        </div>
        <div className="relative -mt-12 px-5">
          <div className="flex items-end gap-3">
            {v.logo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={v.logo} alt={v.name} className="h-20 w-20 rounded-2xl border-4 border-canvas object-cover shadow-lg" />
            ) : (
              <div className="grid h-20 w-20 place-items-center rounded-2xl border-4 border-canvas bg-brand-500 text-2xl font-bold text-white shadow-lg">
                {v.name.charAt(0)}
              </div>
            )}
            <div className="pb-1">
              <h1 className="font-display text-2xl font-semibold text-ink">{v.name}</h1>
              {v.sub_title && <p className="text-sm text-muted">{v.sub_title}</p>}
            </div>
          </div>
          {(v.timing || v.address) && (
            <p className="mt-3 text-xs text-muted">
              {v.timing && <span>🕒 {v.timing}</span>}
              {v.timing && v.address && <span> · </span>}
              {v.address && <span>📍 {v.address}</span>}
            </p>
          )}
          {v.description && <p className="mt-3 text-sm leading-relaxed text-ink/80">{v.description}</p>}
        </div>
      </header>

      {categories.length === 0 ? (
        <p className="px-5 py-16 text-center text-sm text-muted">{labels.empty}</p>
      ) : (
        categories.map((c) => (
          <section key={c.id} className="px-5 pt-8">
            <h2 className="mb-4 font-display text-xl font-semibold text-brand-700">{c.name}</h2>
            <div className="space-y-3.5">
              {c.products.map((p) => (
                <article key={p.id} className="flex gap-4 overflow-hidden rounded-2xl border border-line bg-surface shadow-sm">
                  {p.images?.[0] && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.images[0]} alt={p.name} className="h-28 w-28 shrink-0 object-cover" />
                  )}
                  <div className="min-w-0 flex-1 py-3 pr-4">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-display text-lg font-semibold text-ink">{p.name}</h3>
                      <span className="shrink-0 font-display font-semibold text-brand-600">{format.format(Number(p.price))}</span>
                    </div>
                    {p.description && <p className="mt-1 text-sm leading-relaxed text-muted">{p.description}</p>}
                    {p.nutrition && (
                      <span className="mt-2 inline-block rounded-full bg-amber-bg px-2.5 py-0.5 text-xs font-semibold text-[color:var(--color-amber)]">
                        {Math.round(p.nutrition.kcal)} {labels.kcal}
                      </span>
                    )}
                  </div>
                </article>
              ))}
            </div>
          </section>
        ))
      )}
    </div>
  );
}

/* ---------------------------------------------------------------- Flipbook */
/* Printed-menu / magazine look: centered serif, dotted price leaders, no photos. */

function FlipbookMenu({ menu, labels, format, categories }: ThemeProps) {
  const v = menu.venue;
  return (
    <div className="min-h-screen bg-[#faf6ef]">
      <div className="mx-auto max-w-2xl px-6 pb-20 pt-10">
        <header className="border-y-2 border-[#2b2620] py-6 text-center">
          {v.sub_title && <p className="text-[11px] uppercase tracking-[0.35em] text-[#8a7f6d]">{v.sub_title}</p>}
          <h1 className="mt-1 font-display text-4xl font-semibold uppercase tracking-wide text-[#2b2620]">{v.name}</h1>
          {v.timing && <p className="mt-2 text-xs italic text-[#8a7f6d]">{v.timing}</p>}
        </header>

        {categories.length === 0 ? (
          <p className="py-16 text-center text-sm text-[#8a7f6d]">{labels.empty}</p>
        ) : (
          categories.map((c) => (
            <section key={c.id} className="pt-10">
              <h2 className="mb-5 text-center font-display text-2xl font-semibold uppercase tracking-[0.2em] text-[#2b2620]">
                <span className="mx-3 inline-block align-middle">{c.name}</span>
              </h2>
              <div className="space-y-4">
                {c.products.map((p) => (
                  <div key={p.id}>
                    <div className="flex items-baseline gap-2">
                      <span className="font-display text-lg font-medium text-[#2b2620]">{p.name}</span>
                      <span className="mx-1 flex-1 translate-y-[-0.2em] border-b border-dotted border-[#b8ab93]" />
                      <span className="font-display text-lg font-semibold text-[#2b2620]">{format.format(Number(p.price))}</span>
                    </div>
                    {p.description && <p className="mt-0.5 max-w-[85%] text-sm italic leading-snug text-[#8a7f6d]">{p.description}</p>}
                    {p.nutrition && <span className="text-[11px] text-[#b8ab93]">{Math.round(p.nutrition.kcal)} {labels.kcal}</span>}
                  </div>
                ))}
              </div>
            </section>
          ))
        )}

        {v.address && <p className="mt-12 border-t border-[#b8ab93] pt-4 text-center text-xs text-[#8a7f6d]">📍 {v.address}</p>}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------- shared bits */

function Diet({ label }: { label: string }) {
  return <span className="rounded-md bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800">{label}</span>;
}

function FilterChip({ active, onClick, tone, children }: { active: boolean; onClick: () => void; tone: 'red' | 'amber' | 'sky'; children: React.ReactNode }) {
  const tones = {
    red: active ? 'border-red-300 bg-red-100 text-red-700' : 'border-red-200 bg-red-50 text-red-600',
    amber: active ? 'border-amber-400 bg-amber-200 text-amber-900' : 'border-amber-200 bg-amber-50 text-amber-700',
    sky: active ? 'border-sky-400 bg-sky-200 text-sky-900' : 'border-sky-200 bg-sky-50 text-sky-700',
  };
  return (
    <button
      onClick={onClick}
      className={`shrink-0 whitespace-nowrap rounded-lg border px-2.5 py-1 text-xs font-semibold transition ${tones[tone]}`}
    >
      {children}
    </button>
  );
}
