'use client';

import { useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import { useLocale, useMessages } from 'next-intl';
import { MARKETING_LOCALES, MARKETING_LOCALE_NAMES } from '@/i18n/locales';
import Link from 'next/link';
import { BrandLogo } from '@/components/BrandLogo';
import { createApi } from '@/lib/api';
import { isAuthenticated } from '@/lib/auth';
import { CONTACT_EMAIL, CUSTOMER_URL, DEMOS, OFFICES, PRIMARY_OFFICE, TRIAL_DAYS, demoUrl, telHref } from '@/lib/marketing';
import type { MarketingContent } from '@/lib/marketing';
import type { LandingMedia } from '@/lib/landing-content';

/* Orange brand scope — overrides the admin's indigo tokens for the public site only. */
const ORANGE: CSSProperties = {
  ['--color-brand-50' as string]: '#fff3ec',
  ['--color-brand-100' as string]: '#ffe1ce',
  ['--color-brand-500' as string]: '#ea5b1a',
  ['--color-brand-600' as string]: '#c9490f',
  ['--color-brand-700' as string]: '#9e3a0c',
};

function Check() {
  return (
    <svg viewBox="0 0 24 24" className="mt-0.5 h-[18px] w-[18px] shrink-0 text-brand-500" fill="none" stroke="currentColor" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

function Arrow() {
  return <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6" /></svg>;
}

/** Servis zinciri: kasadan mutfağa, garsonun cebine. */
function MockService() {
  return (
    <div className="rounded-2xl border border-line bg-surface p-5 shadow-xl">
      <div className="grid grid-cols-3 gap-2">
        {['M1', 'M2', 'M3', 'M4', 'M5', 'M6'].map((code, i) => (
          <div
            key={code}
            className={`rounded-lg px-2 py-3 text-center text-xs font-bold ${i % 3 === 1 ? 'text-white' : 'bg-canvas text-ink'}`}
            style={i % 3 === 1 ? { background: '#ea5b1a', color: '#ffffff' } : undefined}
          >
            {code}
            <div className="mt-0.5 text-[9px] font-semibold opacity-70">{i % 3 === 1 ? 'Açık' : 'Boş'}</div>
          </div>
        ))}
      </div>

      <div className="mt-4 rounded-xl border border-line bg-canvas p-3">
        <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wide text-muted">
          <span>Mutfak ekranı</span>
          <span>M2 · 3 kalem</span>
        </div>
        <div className="mt-2 space-y-1.5">
          {[['2×', 'Adana Kebap', 'Hazırlanıyor'], ['1×', 'Humus', 'Hazır'], ['1×', 'Ayran', 'Hazır']].map(([q, n, s]) => (
            <div key={n} className="flex items-center gap-2 text-xs">
              <span className="font-bold text-ink">{q}</span>
              <span className="flex-1 truncate text-ink">{n}</span>
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${s === 'Hazır' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-800'}`}>{s}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-3 flex items-center gap-2 rounded-xl border border-line bg-canvas px-3 py-2.5">
        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg text-[13px]" style={{ background: '#ea5b1a', color: '#ffffff' }}>👤</span>
        <span className="text-xs text-muted">Garson uygulaması: <b className="text-ink">M2 hesap istedi</b></span>
      </div>
    </div>
  );
}

/** Kâr tablosu + saatlik yoğunluk şeridi — panelin gerçek kokpitinin özeti. */
function MockFinance() {
  const heat = [8, 14, 22, 18, 30, 62, 96, 74, 40, 26];

  return (
    <div className="rounded-2xl border border-line bg-surface p-5 shadow-xl">
      <div className="grid grid-cols-3 gap-3">
        {[['₺184.500', 'Net satış'], ['₺61.200', 'Ürün maliyeti'], ['₺48.900', 'Net kâr']].map(([n, l], i) => (
          <div key={l} className="rounded-xl bg-canvas p-3 text-center">
            <div className={`text-[15px] font-extrabold tracking-tight ${i === 2 ? 'text-emerald-600' : 'text-ink'}`}>{n}</div>
            <div className="text-[10px] font-semibold text-muted">{l}</div>
          </div>
        ))}
      </div>

      <div className="mt-4">
        <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wide text-muted">
          <span>Saatlik yoğunluk</span>
          <span>Zirve 20:00</span>
        </div>
        <div className="mt-2 flex items-end gap-1.5">
          {heat.map((v, i) => (
            <span
              key={i}
              className="flex-1 rounded-sm"
              style={{ height: `${Math.max(8, v * 0.6)}px`, background: `rgba(234,91,26,${0.2 + (v / 100) * 0.8})` }}
            />
          ))}
        </div>
      </div>

      <div className="mt-4 space-y-1.5">
        {[['Kira', '₺18.000'], ['Personel', '₺42.400'], ['Tedarik (vadeli)', '₺23.900']].map(([n, v]) => (
          <div key={n} className="flex items-center justify-between rounded-lg bg-canvas px-3 py-2 text-xs">
            <span className="text-ink">{n}</span>
            <span className="font-semibold text-muted">{v}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Dil seçici. Her dilin kendi adresi olduğu için çerez yazmak yerine bağlantı
 * veriyor: seçim paylaşılabilir ve arama motoru her dili ayrı sayfa olarak görür.
 * Türkçe kökte (/) yayınlanıyor.
 */
function LanguagePicker({ current, label }: { current: string; label: string }) {
  const [open, setOpen] = useState(false);
  const href = (code: string) => (code === 'tr' ? '/' : `/${code}`);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={label}
        aria-expanded={open}
        className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface px-2.5 py-1.5 text-xs font-semibold text-ink transition hover:bg-canvas"
      >
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
          <path d="M12 21a9 9 0 100-18 9 9 0 000 18zM3 12h18M12 3c2.5 2.6 2.5 15 0 18M12 3c-2.5 2.6-2.5 15 0 18" />
        </svg>
        {current.toUpperCase()}
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-2 w-40 overflow-hidden rounded-xl border border-line bg-surface py-1 shadow-lg">
          {MARKETING_LOCALES.map((code) => (
            <a
              key={code}
              href={href(code)}
              hrefLang={code}
              className={`block px-4 py-2 text-sm transition hover:bg-canvas ${code === current ? 'font-bold text-brand-600' : 'text-ink'}`}
            >
              {MARKETING_LOCALE_NAMES[code]}
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

/* ---- Feature section: text + checklist on one side, mockup on the other ---- */
function FeatureSection({ badge, title, body, points, mockup, flip }: { badge: string; title: string; body: string; points: string[]; mockup: ReactNode; flip?: boolean }) {
  return (
    <div className="mx-auto grid max-w-6xl items-center gap-12 px-5 py-16 lg:grid-cols-2 lg:gap-16 lg:py-20">
      <div className={flip ? 'lg:order-2' : ''}>
        <span className="inline-flex items-center gap-2 rounded-full bg-brand-50 px-3 py-1 text-xs font-bold uppercase tracking-wide text-brand-600">{badge}</span>
        <h2 className="mt-4 text-3xl font-extrabold leading-tight tracking-tight text-balance sm:text-[2.4rem]">{title}</h2>
        <p className="mt-4 text-lg leading-relaxed text-muted">{body}</p>
        <ul className="mt-6 space-y-3">
          {points.map((p) => (
            <li key={p} className="flex gap-3 text-[15px]"><Check /><span>{p}</span></li>
          ))}
        </ul>
      </div>
      <div className={flip ? 'lg:order-1' : ''}>{mockup}</div>
    </div>
  );
}

/* ---------------------------------------------------------------- Mockups */
function MockLive() {
  return (
    <div className="rounded-2xl border border-line bg-surface p-5 shadow-xl">
      <div className="grid grid-cols-2 gap-3">
        {[['Klasik', '₺120', false], ['Kampanya', '₺96', true]].map(([t, p, promo]) => (
          <div key={t as string} className={`rounded-xl border p-3 ${promo ? 'border-brand-500 bg-brand-50' : 'border-line bg-canvas'}`}>
            <span className="h-16 w-full rounded-lg" style={{ display: 'block', background: 'linear-gradient(135deg,#e8a24a,#d9762f)' }} />
            <div className="mt-2 flex items-center justify-between">
              <span className="text-[13px] font-bold">Margarita Pizza</span>
              {promo ? <span className="rounded bg-brand-500 px-1.5 py-0.5 text-[10px] font-bold text-white">-%20</span> : null}
            </div>
            <div className="text-[13px] font-extrabold text-brand-600">{p as string}</div>
          </div>
        ))}
      </div>
      <div className="mt-3 flex items-center gap-2 rounded-lg bg-canvas p-2.5 text-[12px] text-muted">
        <span className="h-2 w-2 animate-pulse rounded-full bg-brand-500" /> Değişiklik misafirlere anında yansıdı
      </div>
    </div>
  );
}

function MockOrder() {
  return (
    <div className="rounded-2xl border border-line bg-surface p-4 shadow-xl">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-sm font-bold">Mutfak Ekranı (KDS)</span>
        <span className="rounded-md bg-green-50 px-2 py-0.5 text-[11px] font-bold text-green-700">Canlı</span>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {[['Masa 7', ['1× Adana Kebap', '2× Ayran'], 'Hazırlanıyor'], ['Masa 3', ['1× Humus', '1× Kuzu Şiş'], 'Yeni']].map(([tbl, items, st]) => (
          <div key={tbl as string} className="rounded-xl border border-line bg-canvas p-3">
            <div className="flex items-center justify-between">
              <span className="text-[13px] font-extrabold">{tbl as string}</span>
              <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${st === 'Yeni' ? 'bg-brand-100 text-brand-700' : 'bg-amber-100 text-amber-700'}`}>{st as string}</span>
            </div>
            <ul className="mt-2 space-y-1 text-[12px] text-muted">
              {(items as string[]).map((i) => <li key={i}>{i}</li>)}
            </ul>
          </div>
        ))}
      </div>
      <div className="mt-3 flex gap-2">
        <span className="flex-1 rounded-lg bg-brand-500 py-2 text-center text-[12px] font-bold text-white">🔔 Garson çağrıldı · Masa 7</span>
      </div>
    </div>
  );
}

function MockChat() {
  return (
    <div className="rounded-2xl border border-line bg-surface p-4 shadow-xl">
      <div className="mb-3 flex items-center gap-2 border-b border-line pb-3">
        <span className="grid h-8 w-8 place-items-center rounded-full bg-brand-500 text-sm text-white">🤖</span>
        <div><div className="text-[13px] font-bold">Menü Asistanı</div><div className="text-[11px] text-brand-600">● çevrimiçi</div></div>
      </div>
      <div className="space-y-2.5">
        <div className="ml-auto max-w-[80%] rounded-2xl rounded-tr-sm bg-brand-500 px-3.5 py-2 text-[13px] text-white">Glutensiz ve az kalorili ne önerirsin?</div>
        <div className="mr-auto max-w-[85%] rounded-2xl rounded-tl-sm bg-canvas px-3.5 py-2 text-[13px]">Kuzu Şiş (glutensiz, 560 kcal) veya Çoban Salata (vegan, 90 kcal) harika olur. İster misiniz?</div>
        <div className="ml-auto max-w-[80%] rounded-2xl rounded-tr-sm bg-brand-500 px-3.5 py-2 text-[13px] text-white">Kaçta kapanıyorsunuz?</div>
        <div className="mr-auto max-w-[70%] rounded-2xl rounded-tl-sm bg-canvas px-3.5 py-2 text-[13px]">Bugün 23:00’a kadar açığız 🌙</div>
      </div>
    </div>
  );
}

function MockAnalytics() {
  return (
    <div className="rounded-2xl border border-line bg-surface p-5 shadow-xl">
      <div className="grid grid-cols-3 gap-3">
        {[['8.950', 'Menü açılışı'], ['125.280', 'Görüntülenme'], ['4dk 9sn', 'Ort. süre']].map(([n, l]) => (
          <div key={l} className="rounded-xl bg-canvas p-3 text-center">
            <div className="text-lg font-extrabold tracking-tight">{n}</div>
            <div className="text-[10px] font-semibold text-muted">{l}</div>
          </div>
        ))}
      </div>
      <svg viewBox="0 0 320 110" className="mt-4 w-full" preserveAspectRatio="none">
        <defs>
          <linearGradient id="af" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#ea5b1a" stopOpacity="0.28" />
            <stop offset="1" stopColor="#ea5b1a" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d="M0 80 C 40 70, 60 40, 90 48 S 150 88, 190 60 S 260 18, 320 34 L320 110 L0 110 Z" fill="url(#af)" />
        <path d="M0 80 C 40 70, 60 40, 90 48 S 150 88, 190 60 S 260 18, 320 34" fill="none" stroke="#ea5b1a" strokeWidth="2.5" strokeLinecap="round" />
      </svg>
    </div>
  );
}

/* --------------------------------------------------------------- Content */
/** Emoji ve sıra burada; metin çeviri dosyasından gelir. */
const VERTICAL_KEYS = [
  { e: '🍽️', k: 'restaurant' },
  { e: '🏨', k: 'hotel' },
  { e: '🍹', k: 'bar' },
  { e: '🏖️', k: 'beach' },
] as const;

/**
 * API'ye ulaşılamazsa fiyat bölümü boş kalmasın diye yedek. Kaynak gerçeklik
 * PlanSeeder'dır; buradaki kopya yalnızca sayfanın ayakta kalması içindir.
 */
const FALLBACK_PLANS = [
  { code: 'free', name: 'Free', price_monthly: 0, price_yearly: 0, limits: { branches: 1, menu_items: 30, monthly_scans: 500 },
    features: { menu: true, qr: true, nutrition_display: true } },
  { code: 'pro', name: 'Pro', price_monthly: 29, price_yearly: 290, limits: { branches: 1, menu_items: -1, monthly_scans: 10000 },
    features: { menu: true, qr: true, nutrition_display: true, nutrition_full: true, ordering: true, payments: true, kds: true, waiter_app: true, printing: true, analytics: true, ai: true, happy_hour: true } },
  { code: 'business', name: 'Business', price_monthly: 79, price_yearly: 790, limits: { branches: 5, menu_items: -1, monthly_scans: 50000 },
    features: { menu: true, qr: true, nutrition_display: true, nutrition_full: true, ordering: true, payments: true, kds: true, waiter_app: true, printing: true, analytics: true, ai: true, ai_advanced: true, loyalty: true, multi_branch: true, folio: true, happy_hour: true, finance: true, pos_integration: true } },
  { code: 'enterprise', name: 'Enterprise', price_monthly: 0, price_yearly: 0, limits: { branches: -1, menu_items: -1, monthly_scans: -1 },
    features: { menu: true, qr: true, nutrition_display: true, nutrition_full: true, ordering: true, payments: true, kds: true, waiter_app: true, printing: true, analytics: true, ai: true, ai_advanced: true, loyalty: true, multi_branch: true, folio: true, happy_hour: true, finance: true, pos_integration: true, white_label: true, sla: true } },
];


/**
 * Plan kartlarının pazarlama tarafı. Fiyat, limit ve özellik işaretleri API'den
 * gelir (superadmin planı panelden değiştirebiliyor); burada yalnızca sıralama,
 * anlatım ve hangi kartın öne çıkacağı durur. Böylece liste gerçeklikten kayamaz.
 */
/** Plan sırası ve hangisinin öne çıkacağı; metin çeviri dosyasından. */
const PLAN_ORDER = ['free', 'pro', 'business', 'enterprise'] as const;
const POPULAR_PLAN = 'pro';

/** Karşılaştırma tablosu — işaretler plan bayraklarından gelir, elle yazılmaz. */
/** Karşılaştırma tablosunun satır sırası; etiketler çeviri dosyasından. */
const FEATURE_KEYS = [
  'menu', 'nutrition_display', 'nutrition_full', 'ordering', 'payments', 'kds', 'waiter_app',
  'printing', 'analytics', 'ai', 'ai_advanced', 'loyalty', 'multi_branch', 'folio',
  'happy_hour', 'finance', 'pos_integration', 'white_label', 'sla',
] as const;

const LIMIT_KEYS = ['branches', 'menu_items', 'monthly_scans'] as const;

/** -1 / eksik değer = sınırsız. */
function limitLabel(v: unknown, unlimited: string): string {
  const n = Number(v);
  if (v === undefined || v === null || !Number.isFinite(n) || n === -1) return unlimited;

  return n.toLocaleString('tr-TR');
}

type Billing = 'monthly' | 'yearly';

/**
 * Yıllıkta gösterilen rakam AYLIK karşılıktır (yıllık ÷ 12) — kartlar arasında
 * elma-elma karşılaştırma bozulmasın diye. Toplam yıllık tutar altında yazar.
 */
function priceLabel(
  p: { code: string; price_monthly?: unknown; price_yearly?: unknown },
  billing: Billing,
  labels: { custom: string; perMonth: string; yearlyNote: string },
) {
  if (p.code === 'enterprise') return { price: labels.custom, per: '', note: '' };

  const monthly = Number(p.price_monthly ?? 0);
  const yearly = Number(p.price_yearly ?? 0);

  if (billing === 'yearly' && yearly > 0) {
    const perMonth = Math.round(yearly / 12);

    return {
      price: `₺${perMonth.toLocaleString('tr-TR')}`,
      per: labels.perMonth,
      note: labels.yearlyNote.replace('{total}', `₺${yearly.toLocaleString('tr-TR')}`),
    };
  }

  return { price: monthly > 0 ? `₺${monthly.toLocaleString('tr-TR')}` : '₺0', per: labels.perMonth, note: '' };
}

/** Yıllık ödemenin aylığa göre kazandırdığı yüzde; planlar arasında en yükseği. */
function yearlySavingPct(plans: any[]): number {
  const rates = plans
    .map((p) => {
      const m = Number(p.price_monthly ?? 0) * 12;
      const y = Number(p.price_yearly ?? 0);

      return m > 0 && y > 0 && y < m ? Math.round(((m - y) / m) * 100) : 0;
    })
    .filter((r) => r > 0);

  return rates.length ? Math.max(...rates) : 0;
}


/** Kart ikonları; başlık ve metin çeviri dosyasından (aynı sırada). */
const MORE_ICONS = [
  'M4 4h16v16H4zM4 14l4-4 4 4 3-3 5 5M8.5 9.5a1 1 0 100-.01',
  'M3 4h18l-7 9v6l-4 2v-8z',
  'M3 7v5l8 8 9-9-8-8H6a3 3 0 00-3 3zM7.5 7.5h.01',
  'M3 3v18h18M7 14l3-3 3 2 5-6',
  'M4 21V8l8-5 8 5v13M9 21v-6h6v6M4 21h16',
  'M12 3l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9 6.8 19.1l1-5.8L3.5 9.2l5.9-.9z',
  'M4 7h16v13H4zM4 7l2-3h12l2 3M9 12h6',
  'M12 21a9 9 0 100-18 9 9 0 000 18zM3 12h18M12 3c2.5 2.6 2.5 15 0 18M12 3c-2.5 2.6-2.5 15 0 18',
];

export default function MarketingHome({ media = {} }: { media?: LandingMedia }) {
  const [authed, setAuthed] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [open, setOpen] = useState<number | null>(0);
  const [plans, setPlans] = useState<any[]>(FALLBACK_PLANS);
  const [billing, setBilling] = useState<Billing>('monthly');
  const saving = yearlySavingPct(plans);
  // Tüm pazarlama metni çeviri dosyasından; dizileri olduğu gibi okuyabilmek için
  // useTranslations yerine ham mesaj ağacı kullanılıyor.
  const M = (useMessages() as any).marketing as MarketingContent;
  const locale = useLocale();

  useEffect(() => {
    setAuthed(isAuthenticated());
    // Fiyat ve özellik işaretleri gerçek plan kayıtlarından gelsin: superadmin planı
    // panelden değiştirdiğinde sayfa kendiliğinden doğru kalır. Ulaşılamazsa yedek liste kalır.
    createApi()
      .plans()
      .then((list: any[]) => { if (Array.isArray(list) && list.length) setPlans(list); })
      .catch(() => undefined);
    const onScroll = () => setScrolled(window.scrollY > 8);
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const primaryHref = authed ? '/dashboard' : '/register';

  return (
    <div style={ORANGE} className="min-h-screen bg-canvas text-ink">
      {/* NAV */}
      <nav className={`sticky top-0 z-50 backdrop-blur transition ${scrolled ? 'border-b border-line bg-canvas/85' : 'bg-canvas/60'}`}>
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5">
          <div className="flex items-center gap-2.5">
            <BrandLogo className="h-9 w-auto" />
          </div>
          <div className="hidden items-center gap-8 md:flex">
            <a href="#ozellikler" className="text-sm font-semibold text-muted transition hover:text-ink">{M.nav.features}</a>
            <a href="#turler" className="text-sm font-semibold text-muted transition hover:text-ink">{M.nav.verticals}</a>
            <a href="#fiyatlar" className="text-sm font-semibold text-muted transition hover:text-ink">{M.nav.pricing}</a>
            <a href="#sss" className="text-sm font-semibold text-muted transition hover:text-ink">{M.nav.faq}</a>
            <a href="#iletisim" className="text-sm font-semibold text-muted transition hover:text-ink">{M.nav.contact}</a>
          </div>
          <div className="flex items-center gap-2.5">
            <LanguagePicker current={locale} label={M.nav.language} />
            {!authed && <Link href="/login" className="hidden text-sm font-semibold text-muted transition hover:text-ink sm:block">{M.nav.login}</Link>}
            <Link href={primaryHref} className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-600">{authed ? M.nav.panel : M.nav.try}</Link>
            <button type="button" onClick={() => setMenuOpen((o) => !o)} aria-label={M.nav.menu} aria-expanded={menuOpen} className="grid h-9 w-9 place-items-center rounded-lg border border-line bg-surface text-ink md:hidden">
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
                {menuOpen ? <path d="m6 6 12 12M18 6 6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
              </svg>
            </button>
          </div>
        </div>
        {menuOpen && (
          <div className="border-t border-line bg-canvas md:hidden">
            <div className="mx-auto flex max-w-6xl flex-col px-5 py-2">
              {([[M.nav.features, '#ozellikler'], [M.nav.verticals, '#turler'], [M.nav.pricing, '#fiyatlar'], [M.nav.faq, '#sss'], [M.nav.contact, '#iletisim']] as [string, string][]).map(([l, href]) => (
                <a key={href} href={href} onClick={() => setMenuOpen(false)} className="border-b border-line/70 py-3 text-sm font-semibold text-ink last:border-0">{l}</a>
              ))}
              {!authed && <Link href="/login" onClick={() => setMenuOpen(false)} className="py-3 text-sm font-semibold text-brand-600">{M.nav.loginLong}</Link>}
            </div>
          </div>
        )}
      </nav>

      {/* HERO */}
      <header className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0" style={{ background: 'radial-gradient(720px 380px at 12% -10%, rgba(234,91,26,.16), transparent 60%)' }} />
        <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-5 py-16 lg:grid-cols-2 lg:py-24">
          <div>
            <h1 className="text-[2.7rem] font-extrabold leading-[1.04] tracking-tight text-balance sm:text-6xl">
              {M.hero.title1} <span className="text-brand-600">{M.hero.title2}</span>
              <span className="block">{M.hero.title3}</span>
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted">
              {M.hero.body}
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href={primaryHref} className="inline-flex items-center gap-2 rounded-xl bg-brand-500 px-6 py-3.5 text-sm font-bold text-white shadow-sm transition hover:bg-brand-600 hover:shadow-md">
                {authed ? M.nav.panel : M.nav.try} <Arrow />
              </Link>
              <a
                href={demoUrl(DEMOS[0]!.slug)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-xl border border-line bg-surface px-6 py-3.5 text-sm font-bold text-ink shadow-sm transition hover:bg-canvas"
              >
                {M.hero.demo}
              </a>
            </div>
            <ul className="mt-7 flex flex-wrap gap-x-5 gap-y-2 text-sm font-semibold text-muted">
              {M.hero.chips.map((x) => (
                <li key={x} className="flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full" style={{ background: '#ea5b1a' }} />
                  {x}
                </li>
              ))}
            </ul>
            <div className="mt-7 flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted">
              {M.hero.checks.map((x) => x.replace('{days}', String(TRIAL_DAYS))).map((x) => (
                <span key={x} className="inline-flex items-center gap-2"><Check />{x}</span>
              ))}
            </div>
          </div>

          {/* Telefon mockup + QR rozeti */}
          <div className="relative flex justify-center">
            <PhoneMockup>
              <LiveMenuScreen labels={M.mockup} screenshot={media.heroPhone} />
            </PhoneMockup>
            <div className="absolute -bottom-4 -left-3 rounded-2xl border border-line bg-surface p-2.5 shadow-xl sm:-left-6">
              <QrGlyph />
            </div>
          </div>
        </div>
      </header>

      {/* CANLI ÖRNEKLER — anlatmak yerine gösteriyoruz. */}
      <div className="border-y border-line bg-surface">
        <div className="mx-auto max-w-6xl px-5 py-10">
          <p className="text-center text-xs font-bold uppercase tracking-widest text-muted">
            {M.demos.label}
          </p>
          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            {DEMOS.map((d) => (
              <a
                key={d.slug}
                href={demoUrl(d.slug)}
                target="_blank"
                rel="noopener noreferrer"
                className="group flex items-center gap-3 rounded-2xl border border-line bg-canvas p-4 transition hover:-translate-y-0.5 hover:shadow-md"
              >
                <span className="text-2xl">{d.emoji}</span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-bold text-ink">{M.demos[d.slug].title} {M.demos.suffix}</span>
                  <span className="block text-xs leading-relaxed text-muted">{M.demos[d.slug].desc}</span>
                </span>
                <span className="text-brand-600 transition group-hover:translate-x-0.5">↗</span>
              </a>
            ))}
          </div>
        </div>
      </div>

      {/* FEATURE SECTIONS */}
      <div id="ozellikler" className="divide-y divide-line">
        <FeatureSection
          flip
          badge={M.sections.live.badge}
          title={M.sections.live.title}
          body={M.sections.live.body}
          points={M.sections.live.points}
          mockup={<MockLive />}
        />
        <FeatureSection
          badge={M.sections.order.badge}
          title={M.sections.order.title}
          body={M.sections.order.body}
          points={M.sections.order.points}
          mockup={<MockOrder />}
        />
        <FeatureSection
          flip
          badge={M.sections.service.badge}
          title={M.sections.service.title}
          body={M.sections.service.body}
          points={M.sections.service.points}
          mockup={<MockService />}
        />
        <FeatureSection
          badge={M.sections.chat.badge}
          title={M.sections.chat.title}
          body={M.sections.chat.body}
          points={M.sections.chat.points}
          mockup={<MockChat />}
        />
        <FeatureSection
          flip
          badge={M.sections.analytics.badge}
          title={M.sections.analytics.title}
          body={M.sections.analytics.body}
          points={M.sections.analytics.points}
          mockup={<MockAnalytics />}
        />
        <FeatureSection
          badge={M.sections.finance.badge}
          title={M.sections.finance.title}
          body={M.sections.finance.body}
          points={M.sections.finance.points}
          mockup={<MockFinance />}
        />
      </div>

      {/* VERTICALS */}
      <section id="turler" className="border-y border-line bg-surface">
        <div className="mx-auto max-w-6xl px-5 py-20 lg:py-24">
          <div className="mx-auto max-w-2xl text-center">
            <span className="text-xs font-bold uppercase tracking-widest text-brand-600">{M.verticals.badge}</span>
            <h2 className="mt-4 text-3xl font-extrabold tracking-tight text-balance sm:text-4xl">{M.verticals.heading}</h2>
            <p className="mt-4 text-lg text-muted">{M.verticals.sub}</p>
          </div>
          <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {VERTICAL_KEYS.map((v) => (
              <div key={v.k} className="rounded-2xl border border-line bg-canvas p-6 transition hover:-translate-y-1 hover:shadow-md">
                <div className="text-3xl">{v.e}</div>
                <h3 className="mt-3 text-base font-bold">{M.verticals.items[v.k].title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-muted">{M.verticals.items[v.k].desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* MORE FEATURES */}
      <section className="mx-auto max-w-6xl px-5 py-20 lg:py-24">
        <div className="mx-auto max-w-2xl text-center">
          <span className="text-xs font-bold uppercase tracking-widest text-brand-600">{M.more.badge}</span>
          <h2 className="mt-4 text-3xl font-extrabold tracking-tight text-balance sm:text-4xl">{M.more.heading}</h2>
        </div>
        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {MORE_ICONS.map((icon, i) => (
            <div key={icon} className="rounded-2xl border border-line bg-surface p-6 shadow-sm">
              <span className="grid h-11 w-11 place-items-center rounded-xl bg-brand-50 text-brand-600">
                <svg viewBox="0 0 24 24" className="h-[22px] w-[22px]" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d={icon} /></svg>
              </span>
              <h3 className="mt-4 text-base font-bold">{M.more.items[i]?.title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-muted">{M.more.items[i]?.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* PRICING */}
      <section id="fiyatlar" className="mx-auto max-w-6xl px-5 py-20 lg:py-28">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-extrabold tracking-tight text-balance sm:text-[2.6rem]">{M.pricing.heading1}<br /><span className="text-brand-600">{M.pricing.heading2}</span></h2>
          <p className="mt-4 text-lg text-muted">{M.pricing.sub.replace('{days}', String(TRIAL_DAYS))}</p>
        </div>

        {/* Dönem seçici — indirim oranı plan verisinden hesaplanır, elle yazılmaz. */}
        <div className="mt-8 flex justify-center">
          <div className="inline-flex items-center gap-1 rounded-xl border border-line bg-surface p-1 shadow-sm">
            {(['monthly', 'yearly'] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => setBilling(mode)}
                className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${billing === mode ? 'shadow-sm' : 'text-muted hover:text-ink'}`}
                style={billing === mode ? { background: '#ea5b1a', color: '#ffffff' } : undefined}
              >
                {mode === 'monthly' ? M.pricing.monthly : M.pricing.yearly}
              </button>
            ))}
          </div>
          {saving > 0 && (
            <span className="ml-3 self-center rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">
              {M.pricing.saving.replace('{pct}', String(saving))}
            </span>
          )}
        </div>

        <div className="mt-14 grid gap-5 lg:grid-cols-4">
          {PLAN_ORDER.map((code) => {
            const p = plans.find((x: any) => x.code === code);
            const meta = p ? M.pricing.plans[code] : null;
            if (!p || !meta) return null;
            const featured = code === POPULAR_PLAN;
            const { price, per, note } = priceLabel(p, billing, M.pricing);
            const caps = LIMIT_KEYS.map((k) => `${M.pricing.limits[k]}: ${limitLabel(p.limits?.[k], M.pricing.unlimited)}`).join(' · ');

            return (
              <div key={code} className={`relative flex flex-col rounded-2xl border bg-surface p-6 ${featured ? 'border-brand-500 shadow-lg ring-1 ring-brand-100' : 'border-line shadow-sm'}`}>
                {featured && <span className="absolute -top-3 left-6 rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-wide" style={{ background: '#ea5b1a', color: '#ffffff' }}>{M.pricing.popular}</span>}
                <div className="text-sm font-bold">{meta.title}</div>
                <div className="mt-3 text-4xl font-extrabold tracking-tight">{price}<span className="text-sm font-semibold text-muted">{per}</span></div>
                {note ? (
                  <p className="mt-1 text-xs font-semibold text-brand-600">{note}</p>
                ) : (
                  <p className="mt-1 text-xs">&nbsp;</p>
                )}
                <p className="mt-2 min-h-[40px] text-sm text-muted">{meta.desc}</p>
                <ul className="my-6 flex-1 space-y-3">
                  {meta.items.map((it) => (<li key={it} className="flex gap-2.5 text-sm"><Check />{it}</li>))}
                </ul>
                <p className="mb-4 text-[11px] leading-relaxed text-muted">{caps}</p>
                <Link href={authed ? '/billing' : '/register'} className={`rounded-xl py-2.5 text-center text-sm font-bold transition ${featured ? 'text-white hover:opacity-90' : 'border border-line bg-surface text-ink hover:bg-canvas'}`} style={featured ? { background: '#ea5b1a', color: '#ffffff' } : undefined}>{meta.cta}</Link>
              </div>
            );
          })}
        </div>

        {/* Karşılaştırma — işaretler plan bayraklarından okunur, elle yazılmaz. */}
        <div className="mt-14 overflow-x-auto rounded-2xl border border-line bg-surface shadow-sm">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-line">
                <th className="px-5 py-4 text-left text-xs font-bold uppercase tracking-wide text-muted">{M.pricing.allFeatures}</th>
                {plans.map((p) => (
                  <th key={p.code} className="px-4 py-4 text-center text-xs font-bold uppercase tracking-wide text-muted">{M.pricing.plans[p.code as keyof typeof M.pricing.plans]?.title ?? p.name}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {FEATURE_KEYS.map((key) => (
                <tr key={key} className="border-b border-line/60 last:border-0">
                  <td className="px-5 py-3 text-ink">{M.pricing.rows[key]}</td>
                  {plans.map((p) => (
                    <td key={p.code} className="px-4 py-3 text-center">
                      {p.features?.[key] === true ? (
                        <span className="inline-block font-bold text-brand-600">✓</span>
                      ) : (
                        <span className="inline-block text-muted/50">—</span>
                      )}
                    </td>
                  ))}
                </tr>
              ))}
              {LIMIT_KEYS.map((key) => (
                <tr key={key} className="border-b border-line/60 bg-canvas/60 last:border-0">
                  <td className="px-5 py-3 font-medium text-ink">{M.pricing.limits[key]}</td>
                  {plans.map((p) => (
                    <td key={p.code} className="px-4 py-3 text-center text-muted">{limitLabel(p.limits?.[key], M.pricing.unlimited)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* FAQ */}
      <section id="sss" className="border-y border-line bg-surface">
        <div className="mx-auto max-w-3xl px-5 py-20 lg:py-24">
          <div className="text-center">
            <h2 className="text-3xl font-extrabold tracking-tight text-balance sm:text-4xl">{M.faq.heading}</h2>
            <p className="mt-3 text-lg text-brand-600 font-semibold">{M.faq.sub}</p>
          </div>
          <div className="mt-10 space-y-3">
            {M.faq.items.map(({ q, a }, i) => (
              <div key={q} className="overflow-hidden rounded-2xl border border-line bg-canvas">
                <button type="button" onClick={() => setOpen(open === i ? null : i)} className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left" aria-expanded={open === i}>
                  <span className="text-[15px] font-bold">{q}</span>
                  <svg viewBox="0 0 24 24" className={`h-5 w-5 shrink-0 text-brand-600 transition-transform ${open === i ? 'rotate-45' : ''}`} fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
                </button>
                {/* Cevap {days} taşıyabilir; ham basılınca akordeon açılınca yer tutucu görünüyordu. */}
                {open === i && <p className="px-5 pb-5 text-[15px] leading-relaxed text-muted">{a.replace('{days}', String(TRIAL_DAYS))}</p>}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* STATS */}
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-x-14 gap-y-6 px-5 py-14 text-center">
        {([['1.000+', M.stats.businesses], ['7', M.stats.languages], ['4', M.stats.verticals], ['%100', M.stats.noApp], [`${TRIAL_DAYS} ${M.stats.days}`, M.stats.trial]] as [string, string][]).map(([n, l]) => (
          <div key={l}>
            <div className="text-3xl font-extrabold tracking-tight text-brand-600">{n}</div>
            <div className="mt-1 text-xs font-semibold text-muted">{l}</div>
          </div>
        ))}
      </div>

      {/* İLETİŞİM — restoran sahibi çoğu zaman formu değil telefonu tercih eder. */}
      <section id="iletisim" className="border-y border-line bg-surface">
        <div className="mx-auto max-w-6xl px-5 py-20 lg:py-24">
          <div className="mx-auto max-w-2xl text-center">
            <span className="text-xs font-bold uppercase tracking-widest text-brand-600">{M.contact.badge}</span>
            <h2 className="mt-4 text-3xl font-extrabold tracking-tight text-balance sm:text-4xl">{M.contact.heading}</h2>
            <p className="mt-4 text-lg text-muted">{M.contact.sub}</p>
          </div>

          <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {OFFICES.map((office) => (
              <div key={office.key} className="rounded-2xl border border-line bg-canvas p-6">
                <h3 className="text-base font-bold text-brand-600">{M.contact.regions[office.key]}</h3>
                <address className="mt-3 not-italic text-sm leading-relaxed text-ink">
                  {office.address.map((line) => (<span key={line} className="block">{line}</span>))}
                </address>
                <a href={telHref(office.phone)} className="mt-4 block text-sm font-semibold text-ink transition hover:text-brand-600">
                  {office.phone}
                </a>
              </div>
            ))}
          </div>

          <div className="mt-10 flex justify-center">
            <a
              href={`mailto:${CONTACT_EMAIL}`}
              className="inline-flex items-center gap-2.5 rounded-xl border border-line bg-canvas px-5 py-3 text-sm font-semibold text-ink shadow-sm transition hover:border-brand-500 hover:text-brand-600"
            >
              <span className="text-brand-600">
                <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M3 5h18v14H3zM3 7l9 6 9-6" /></svg>
              </span>
              {CONTACT_EMAIL}
            </a>
          </div>
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="mx-auto max-w-6xl px-5 pb-24">
        <div className="relative overflow-hidden rounded-3xl px-6 py-16 text-center shadow-xl" style={{ background: 'radial-gradient(120% 140% at 50% -20%,#ea5b1a,#9e3a0c 72%)' }}>
          <h2 className="mx-auto max-w-2xl text-3xl font-extrabold tracking-tight text-white text-balance sm:text-4xl">{M.finalCta.heading.replace('{days}', String(TRIAL_DAYS))}</h2>
          <p className="mt-4 text-sm" style={{ color: '#ffffff', opacity: 0.9 }}>
            {M.finalCta.phone}{' '}
            <a href={telHref(PRIMARY_OFFICE.phone)} className="font-bold underline" style={{ color: '#ffffff' }}>
              {PRIMARY_OFFICE.phone}
            </a>
          </p>
          <p className="mx-auto mt-4 max-w-lg text-lg text-white/85">{M.finalCta.sub}</p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link href={primaryHref} className="rounded-xl bg-white px-6 py-3.5 text-sm font-bold text-brand-700 shadow-sm transition hover:bg-white/90">{authed ? 'Panele Git' : 'Ücretsiz Dene'}</Link>
            {!authed && <Link href="/login" className="rounded-xl border border-white/30 bg-white/10 px-6 py-3.5 text-sm font-bold text-white backdrop-blur transition hover:bg-white/20">Giriş Yap</Link>}
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-line bg-surface">
        <div className="mx-auto max-w-6xl px-5 py-14">
          <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <div className="flex items-center gap-2.5">
                <BrandLogo className="h-9 w-auto" />
              </div>
              <p className="mt-4 max-w-xs text-sm text-muted">{M.footer.tagline}</p>
            </div>
            {([
              [M.footer.platform, [[M.footer.links.features, '#ozellikler'], [M.footer.links.verticals, '#turler'], [M.footer.links.pricing, '#fiyatlar'], [M.footer.links.faq, '#sss']]],
              [M.footer.start, [[M.footer.links.register, '/register'], [M.footer.links.login, '/login'], [M.footer.links.panel, '/dashboard']]],
              [M.footer.company, [[M.footer.links.contact, '/iletisim'], [M.footer.links.privacy, '/gizlilik'], [M.footer.links.terms, '/kosullar']]],
            ] as [string, [string, string][]][]).map(([h, links]) => (
              <div key={h}>
                <h4 className="text-xs font-bold uppercase tracking-widest text-muted">{h}</h4>
                <div className="mt-4 space-y-2.5">
                  {links.map(([l, href]) => (<Link key={l} href={href} className="block text-sm font-medium text-ink/80 transition hover:text-brand-600">{l}</Link>))}
                </div>
              </div>
            ))}
          </div>
          <div className="mt-12 flex flex-wrap justify-between gap-3 border-t border-line pt-6 text-sm text-muted">
            <span>{M.footer.copyright}</span>
            <span>{M.footer.regions}</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

/* Telefon ekranının ölçüleri. */
const SCREEN_W = 264;
const SCREEN_H = 542;

/**
 * Telefonun içindeki ekran.
 *
 * Panelden bir ekran görüntüsü yüklendiyse o basılır (Süperadmin → Landing
 * Sayfası → Hero telefon görüntüsü); yoksa çizim gösterilir.
 *
 * Burada bir zamanlar canlı demo menü iframe olarak gömülüydü. Kaldırıldı:
 * menü sayfası 63 görsel istiyor ve bunu hero her açılışta tetikliyordu —
 * yalnız ağır olmakla kalmayıp sayfanın KENDİ içeriğini okuduğu API'yi aç
 * bırakıyordu (tek iş parçacıklı sunucuda `/v1/landing` kuyruğun arkasında
 * kalıp zaman aşımına düşüyor, panel düzenlemeleri görünmüyordu). Gerçek
 * görüntü isteniyorsa doğru yol yüklenen ekran görüntüsü: aynı sonuç, çalışma
 * zamanı maliyeti yok, müşteri uygulamasının ayakta olmasına bağlı değil.
 */
function LiveMenuScreen({ labels, screenshot }: { labels: { add: string; cart: string }; screenshot?: string }) {
  return (
    <div className="relative bg-canvas" style={{ height: SCREEN_H }}>
      {screenshot ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={screenshot} alt="" className="h-full w-full object-cover object-top" />
      ) : (
        <MenuScreenPlaceholder labels={labels} />
      )}
    </div>
  );
}

/** Menü gelene kadar (ve gelmezse) görünen çizim. */
function MenuScreenPlaceholder({ labels }: { labels: { add: string; cart: string } }) {
  const items: [string, string, string][] = [
    ['Adana Kebap', '₺260', 'linear-gradient(135deg,#e8a24a,#d9762f)'],
    ['Sezar Salata', '₺130', 'linear-gradient(135deg,#8bbf5a,#5a9e3a)'],
    ['Humus', '₺90', 'linear-gradient(135deg,#7ba05b,#4f7a3a)'],
    ['Kuzu Şiş', '₺320', 'linear-gradient(135deg,#d98b4a,#b8532a)'],
  ];

  return (
    <div className="absolute inset-0 flex flex-col">
      <div style={{ background: 'linear-gradient(150deg,#c9490f,#ea5b1a 55%,#f6944f)' }}>
        {/* Durum çubuğu cihaz katmanından geliyor; burada yalnız yeri boş bırakılır. */}
        <div className="mt-11 flex items-center justify-between px-3">
          <span className="rounded-lg bg-white/95 px-2.5 py-1.5 text-[11px] font-bold text-ink shadow">🌐</span>
          <span className="rounded-lg bg-white/95 px-2.5 py-1.5 text-[11px] font-bold text-ink shadow">🛒</span>
        </div>
        <div className="pb-3 pt-5 text-center text-2xl font-extrabold italic tracking-wide" style={{ color: '#fffbeb' }}>BOWLS</div>
      </div>

      <div className="flex-1 space-y-2 overflow-hidden p-3">
        {items.map(([n, p, g]) => (
          <div key={n} className="flex gap-2.5 rounded-2xl border border-line bg-surface p-2.5 shadow-sm">
            <span className="h-11 w-11 shrink-0 rounded-xl" style={{ background: g }} />
            <div className="min-w-0 flex-1">
              <div className="text-[13px] font-bold">{n}</div>
              <div className="mt-1 flex items-center justify-between">
                <span className="text-[13px] font-extrabold">{p}</span>
                <span className="rounded-full bg-brand-500 px-2.5 py-0.5 text-[10px] font-bold" style={{ color: '#ffffff' }}>+ {labels.add}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="px-3 pb-2">
        <div className="flex items-center justify-between rounded-full bg-brand-500 px-4 py-2.5 text-[12px] font-bold" style={{ color: '#ffffff' }}>
          <span>{labels.cart} · 2</span>
          <span>₺390</span>
        </div>
      </div>
    </div>
  );
}

/**
 * Hero'daki cihaz çerçevesi.
 *
 * Menü örneği önce çerçevesiz, havada duran bir karttı — ürünün misafirin KENDİ
 * telefonunda açıldığı okunmuyordu. Gövde üç katman: dış metal kenar (degrade),
 * iç siyah cam halkası ve ekran. Yan tuşlar çerçevenin dışına birkaç piksel
 * taşar; hacim hissini veren şey bu taşma.
 */
function PhoneMockup({ children }: { children: ReactNode }) {
  const sideButton = 'absolute w-[3px] rounded-sm';

  return (
    <div className="relative w-[288px] max-w-full">
      {/* Sessize alma + ses tuşları (sol), güç tuşu (sağ). */}
      <span className={`${sideButton} -left-[2px] top-[92px] h-8`} style={{ background: 'linear-gradient(90deg,#7c8493,#3a414e)' }} />
      <span className={`${sideButton} -left-[2px] top-[136px] h-12`} style={{ background: 'linear-gradient(90deg,#7c8493,#3a414e)' }} />
      <span className={`${sideButton} -left-[2px] top-[196px] h-12`} style={{ background: 'linear-gradient(90deg,#7c8493,#3a414e)' }} />
      <span className={`${sideButton} -right-[2px] top-[160px] h-16`} style={{ background: 'linear-gradient(270deg,#7c8493,#3a414e)' }} />

      <div
        className="rounded-[2.9rem] p-[3px] shadow-2xl"
        style={{ background: 'linear-gradient(150deg,#9aa1ae,#39404c 28%,#1b1f27 62%,#828a97)' }}
      >
        <div className="rounded-[2.78rem] p-[9px]" style={{ background: '#0b0d11' }}>
          <div className="relative overflow-hidden rounded-[2.2rem] bg-canvas">
            {children}

            {/*
              Cihaz katmanı ekranın ÜSTÜNDE durur: içerik canlı menü olduğu için
              durum çubuğu ile ada aksi hâlde ekran içeriğinin altında kalıyordu.
              Menünün kendi rengi bilinmediğinden yazının okunurluğunu üstteki
              koyu perde garanti eder.
            */}
            <div className="pointer-events-none absolute inset-x-0 top-0">
              <div className="absolute inset-x-0 top-0 h-12" style={{ background: 'linear-gradient(180deg,rgba(0,0,0,0.42),rgba(0,0,0,0))' }} />
              <StatusBar />
            </div>
            <div className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-center pb-2">
              <span className="h-1 w-24 rounded-full" style={{ background: 'rgba(0,0,0,0.28)' }} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Ekranın durum çubuğu. Marka degradesinin üzerinde durduğu için yazı ve
 * simgeler inline `#ffffff` ile verilir — Tailwind'in `text-white`'ı tema
 * değişkenleri yeniden eşlendiğinde güvenilir değil.
 */
function StatusBar() {
  const white = '#ffffff';

  return (
    <div className="relative flex items-center justify-between px-5 pt-2.5 text-[11px] font-semibold" style={{ color: white }}>
      <span>9:41</span>
      {/* Dinamik ada: saat ile simgelerin arasına oturur. */}
      <span className="absolute left-1/2 top-[7px] h-[26px] w-[84px] -translate-x-1/2 rounded-full" style={{ background: '#0b0d11' }} />
      <span className="flex items-center gap-[3px]">
        {/* Çekim gücü */}
        <svg viewBox="0 0 16 10" className="h-[9px] w-[15px]" aria-hidden>
          {[0, 1, 2, 3].map((i) => (
            <rect key={i} x={i * 4} y={7 - i * 2.2} width="2.6" height={3 + i * 2.2} rx="0.8" fill={white} />
          ))}
        </svg>
        {/* WiFi */}
        <svg viewBox="0 0 16 12" className="h-[10px] w-[13px]" fill="none" stroke={white} strokeWidth="1.5" strokeLinecap="round" aria-hidden>
          <path d="M1.5 4.2a9.5 9.5 0 0 1 11 0M4 7a6 6 0 0 1 6 0" />
          <circle cx="7" cy="9.6" r="0.9" fill={white} stroke="none" />
        </svg>
        {/* Pil */}
        <svg viewBox="0 0 26 12" className="h-[10px] w-[21px]" aria-hidden>
          <rect x="0.6" y="0.6" width="21" height="10.8" rx="3" fill="none" stroke={white} strokeOpacity="0.55" />
          <rect x="2.2" y="2.2" width="15" height="7.6" rx="1.8" fill={white} />
          <path d="M23.4 4.2v3.6a2 2 0 0 0 0-3.6z" fill={white} fillOpacity="0.6" />
        </svg>
      </span>
    </div>
  );
}

/* Decorative QR glyph (not a real code). */
function QrGlyph() {
  const cells = [
    [1,1,1,1,1,1,1,0,1,0,1,1,1,1,1,1,1],
    [1,0,0,0,0,0,1,0,0,0,1,0,0,0,0,0,1],
    [1,0,1,1,1,0,1,0,1,1,1,0,1,1,1,0,1],
    [1,0,1,1,1,0,1,0,0,0,1,0,1,1,1,0,1],
    [1,0,1,1,1,0,1,0,1,0,1,0,1,1,1,0,1],
    [1,0,0,0,0,0,1,0,0,1,0,0,0,0,0,0,1],
    [1,1,1,1,1,1,1,0,1,0,1,1,1,1,1,1,1],
    [0,0,0,0,0,0,0,0,1,1,0,0,0,0,0,0,0],
    [1,0,1,1,0,1,0,1,0,1,0,1,1,0,1,0,1],
    [0,1,0,0,1,0,1,0,1,0,1,0,0,1,0,1,0],
    [1,1,1,0,1,1,0,1,0,1,0,1,1,0,1,1,1],
    [0,0,0,0,0,0,0,0,1,1,0,1,0,1,0,0,0],
    [1,1,1,1,1,1,1,0,1,0,1,0,1,1,0,1,0],
    [1,0,0,0,0,0,1,0,0,1,0,1,0,0,1,0,1],
    [1,0,1,1,1,0,1,0,1,0,1,1,1,0,1,1,0],
    [1,0,1,1,1,0,1,0,0,1,0,0,1,0,0,1,0],
    [1,1,1,1,1,1,1,0,1,0,1,1,0,1,1,0,1],
  ];
  return (
    <svg viewBox="0 0 17 17" className="h-16 w-16" shapeRendering="crispEdges">
      <rect width="17" height="17" fill="#fff" />
      {cells.flatMap((row, y) => row.map((c, x) => (c ? <rect key={`${x}-${y}`} x={x} y={y} width="1" height="1" fill="#13211b" /> : null)))}
    </svg>
  );
}
