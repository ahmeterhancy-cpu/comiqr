'use client';

import { useMemo, useState, type ReactNode } from 'react';
import { Input } from '@/components/ui';
import { ThemeThumb } from '@/components/ThemeThumb';
import { ImageCropperField } from '@/components/ImageCropperField';
import type { createApi } from '@/lib/api';

type Api = ReturnType<typeof createApi>;
type DayHours = { closed: boolean; open: string; close: string };

const DAY_LABELS = ['Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi', 'Pazar'];
const THEMES: [string, string][] = [
  ['classic', 'Classic'],
  ['flipbook', 'Flipbook'],
  ['modern', 'Modern'],
];
const VERTICALS: [string, string, string][] = [
  ['restaurant', 'Restoran / Kafe', 'Masa siparişi, gel-al, teslimat'],
  ['hotel', 'Otel', 'Oda servisi + odaya yansıt (folyo)'],
  ['beach', 'Plaj Kulübü', 'Şezlong servisi + folyo'],
  ['bar', 'Bar / Pub', 'Adisyon akışı'],
];

// Currencies (ISO 4217); Turkish names generated at runtime via Intl.
const CURRENCY_CODES =
  'TRY EUR USD GBP AED SAR QAR KWD BHD OMR JOD ILS EGP AZN GEL RUB UAH KZT INR PKR CNY JPY KRW THB SGD MYR IDR AUD NZD CAD CHF SEK NOK DKK PLN CZK HUF RON BGN RSD MAD TND DZD ZAR NGN BRL MXN ARS CLP'.split(
    ' ',
  );

// Convenience: picking a country pre-fills a sensible default currency (overridable).
const COUNTRY_CCY: Record<string, string> = {
  CY: 'TRY', TR: 'TRY', US: 'USD', GB: 'GBP', RU: 'RUB', UA: 'UAH', AZ: 'AZN', GE: 'GEL', KZ: 'KZT',
  SA: 'SAR', AE: 'AED', QA: 'QAR', KW: 'KWD', BH: 'BHD', OM: 'OMR', JO: 'JOD', IL: 'ILS', EG: 'EGP',
  IN: 'INR', PK: 'PKR', CN: 'CNY', JP: 'JPY', KR: 'KRW', TH: 'THB', SG: 'SGD', MY: 'MYR', ID: 'IDR',
  AU: 'AUD', NZ: 'NZD', CA: 'CAD', CH: 'CHF', SE: 'SEK', NO: 'NOK', DK: 'DKK', PL: 'PLN', CZ: 'CZK',
  HU: 'HUF', RO: 'RON', BG: 'BGN', RS: 'RSD', MA: 'MAD', TN: 'TND', DZ: 'DZD', ZA: 'ZAR', NG: 'NGN',
  BR: 'BRL', MX: 'MXN', AR: 'ARS', CL: 'CLP',
  DE: 'EUR', FR: 'EUR', IT: 'EUR', ES: 'EUR', NL: 'EUR', BE: 'EUR', AT: 'EUR', PT: 'EUR', GR: 'EUR',
  IE: 'EUR', FI: 'EUR', LU: 'EUR', SK: 'EUR', SI: 'EUR', EE: 'EUR', LV: 'EUR', LT: 'EUR', MT: 'EUR',
};

// Supported UI / menu languages (must match the API's locale allow-list).
const LOCALES: [string, string][] = [
  ['tr', 'Türkçe'],
  ['en', 'English'],
  ['de', 'Deutsch'],
  ['ru', 'Русский'],
  ['ar', 'العربية'],
];

// Convenience: a country suggests a default UI language (mirrors Countries::localeFor).
function localeForCountry(code: string): string | undefined {
  if (['TR', 'CY', 'AZ'].includes(code)) return 'tr';
  if (['DE', 'AT'].includes(code)) return 'de';
  if (['RU', 'BY', 'KZ', 'KG', 'UZ', 'TJ', 'TM', 'UA', 'MD'].includes(code)) return 'ru';
  if (['SA', 'AE', 'QA', 'KW', 'BH', 'OM', 'JO', 'EG', 'IQ', 'SY', 'LB', 'LY', 'DZ', 'MA', 'TN', 'SD', 'YE', 'PS'].includes(code)) return 'ar';
  return undefined; // leave the current choice; the menu defaults to English elsewhere
}

// All countries (ISO 3166-1 alpha-2); Turkish names + flags generated at runtime.
const CODES =
  'AD AE AF AG AI AL AM AO AR AT AU AW AZ BA BB BD BE BF BG BH BI BJ BM BN BO BR BS BT BW BY BZ CA CD CF CG CH CI CL CM CN CO CR CU CV CY CZ DE DJ DK DM DO DZ EC EE EG ER ES ET FI FJ FM FO FR GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GT GU GW GY HK HN HR HT HU ID IE IM IN IQ IR IS IT JE JM JO JP KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MG MH MK ML MM MN MO MQ MR MT MU MV MW MX MY MZ NA NC NE NG NI NL NO NP NR NZ OM PA PE PF PG PH PK PL PR PS PT PW PY QA RE RO RS RU RW SA SB SC SD SE SG SI SK SL SM SN SO SR SS ST SV SY SZ TD TG TH TJ TL TM TN TO TR TT TV TW TZ UA UG US UY UZ VA VC VE VG VI VN VU WS XK YE ZA ZM ZW'.split(
    ' ',
  );

/**
 * First-run setup wizard for a new owner account. Six steps that progressively
 * fill the tenant profile (settings_json), mirroring a "Create Location" flow.
 * Each step PATCHes its own slice (the API merges settings_json recursively), so
 * progress persists even if the owner closes midway. Finishing marks
 * settings_json.onboarding.completed and calls onDone.
 */
export function OnboardingWizard({
  api,
  tenant,
  owner,
  onDone,
  onClose,
}: {
  api: Api;
  tenant: any;
  /** Signed-in owner (me.user) — prefills the authorized-contact step. */
  owner?: { name?: string; email?: string; phone?: string } | null;
  onDone: () => void;
  onClose: () => void;
}) {
  const s = tenant?.settings ?? {};
  const allowedVerticals: string[] | undefined = tenant?.plan?.features?.verticals;

  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Step 1 — basics
  const [name, setName] = useState<string>(tenant?.name ?? '');
  const [vertical, setVertical] = useState<string>(s.vertical ?? 'restaurant');
  const [country, setCountry] = useState<string>(s.country ?? '');
  const [currency, setCurrency] = useState<string>(tenant?.currency ?? 'EUR');
  const [locale, setLocale] = useState<string>(tenant?.locale_default ?? 'tr');
  const [subTitle, setSubTitle] = useState<string>(s.sub_title ?? '');

  // Picking a country nudges currency + default language to that country's defaults
  // (both still overridable by the owner).
  const onCountry = (code: string) => {
    setCountry(code);
    const ccy = COUNTRY_CCY[code];
    if (ccy) setCurrency(ccy);
    const loc = localeForCountry(code);
    if (loc) setLocale(loc);
  };
  // Step 2 — contact & address
  const [address, setAddress] = useState<string>(s.address ?? '');
  const [phone, setPhone] = useState<string>(s.phone ?? '');
  const [email, setEmail] = useState<string>(s.email ?? '');
  const [website, setWebsite] = useState<string>(s.website ?? '');
  // Step 3 — hours
  const [hours, setHours] = useState<DayHours[]>(
    Array.isArray(s.hours) && s.hours.length === 7
      ? s.hours.map((d: any) => ({ closed: !!d?.closed, open: d?.open ?? '09:00', close: d?.close ?? '22:00' }))
      : Array.from({ length: 7 }, (_, i) => ({ closed: i === 6, open: '09:00', close: '22:00' })),
  );
  const setDay = (i: number, patch: Partial<DayHours>) => setHours((prev) => prev.map((d, idx) => (idx === i ? { ...d, ...patch } : d)));
  // Step 4 — social & wifi
  const [instagram, setInstagram] = useState<string>(s.instagram ?? '');
  const [facebook, setFacebook] = useState<string>(s.facebook ?? '');
  const [x, setX] = useState<string>(s.x ?? '');
  const [tiktok, setTiktok] = useState<string>(s.tiktok ?? '');
  const [youtube, setYoutube] = useState<string>(s.youtube ?? '');
  const [whatsapp, setWhatsapp] = useState<string>(s.whatsapp ?? '');
  const [wifiSsid, setWifiSsid] = useState<string>(s.wifi_ssid ?? '');
  const [wifiPassword, setWifiPassword] = useState<string>(s.wifi_password ?? '');
  // Steps 5–7 — theme + logo + cover
  const [theme, setTheme] = useState<string>(s.theme ?? 'classic');
  const [logo, setLogo] = useState<string | null>(s.logo ?? null);
  const [cover, setCover] = useState<string | null>(s.cover ?? null);
  // Step 8 — order preferences
  const [callWaiter, setCallWaiter] = useState<boolean>(s.allow_call_waiter ?? true);
  const [onTable, setOnTable] = useState<boolean>(s.allow_on_table_order ?? true);
  const [takeaway, setTakeaway] = useState<boolean>(s.allow_takeaway ?? true);
  const [delivery, setDelivery] = useState<boolean>(s.allow_delivery ?? true);
  const [online, setOnline] = useState<boolean>(s.allow_online_payment ?? true);
  // Step 7 — business authorized / billing contact
  const a = s.authorized ?? {};
  const [authName, setAuthName] = useState<string>(a.name ?? owner?.name ?? '');
  const [authTitle, setAuthTitle] = useState<string>(a.title ?? '');
  const [authPhone, setAuthPhone] = useState<string>(a.phone ?? owner?.phone ?? '');
  const [authEmail, setAuthEmail] = useState<string>(a.email ?? owner?.email ?? '');
  const [authCompany, setAuthCompany] = useState<string>(a.company ?? '');
  const [authTaxOffice, setAuthTaxOffice] = useState<string>(a.tax_office ?? '');
  const [authTaxNo, setAuthTaxNo] = useState<string>(a.tax_no ?? '');

  const countries = useMemo(() => {
    let dn: Intl.DisplayNames | null = null;
    try {
      dn = new Intl.DisplayNames(['tr'], { type: 'region' });
    } catch {
      dn = null;
    }
    return CODES.map((code) => {
      let cname = code;
      try {
        cname = dn?.of(code) ?? code;
      } catch {
        cname = code;
      }
      const flag = code.replace(/./g, (ch) => String.fromCodePoint(127397 + ch.charCodeAt(0)));
      return { code, flag, name: cname };
    }).sort((a, b) => a.name.localeCompare(b.name, 'tr'));
  }, []);

  const currencies = useMemo(() => {
    let dn: Intl.DisplayNames | null = null;
    try {
      dn = new Intl.DisplayNames(['tr'], { type: 'currency' });
    } catch {
      dn = null;
    }
    return CURRENCY_CODES.map((code) => {
      let cname = code;
      try {
        cname = dn?.of(code) ?? code;
      } catch {
        cname = code;
      }
      return { code, name: cname };
    }).sort((a, b) => a.name.localeCompare(b.name, 'tr'));
  }, []);

  const STEPS = ['Temel Bilgiler', 'İletişim & Adres', 'Çalışma Saatleri', 'Sosyal Medya & WiFi', 'Menü Teması', 'Logo', 'Kapak Görseli', 'Sipariş Tercihleri', 'İşletme Yetkilisi'];
  const isLast = step === STEPS.length - 1;

  /** Persist the current step, then advance (or finish). */
  async function next() {
    setBusy(true);
    setError(null);
    try {
      if (step === 0) {
        if (!name.trim()) {
          setError('İşletme adı gerekli.');
          setBusy(false);
          return;
        }
        // setRegion sets timezone/locale (and a default currency) from the country;
        // we then send the explicitly chosen currency so it always wins.
        if (country && country !== s.country) await api.setRegion(country);
        await api.updateTenant({
          name: name.trim(),
          currency,
          locale_default: locale,
          settings_json: { vertical, sub_title: subTitle.trim() || null },
        } as any);
      } else if (step === 1) {
        await api.updateTenant({
          settings_json: { address: address.trim() || null, phone: phone.trim() || null, email: email.trim() || null, website: website.trim() || null },
        } as any);
      } else if (step === 2) {
        await api.updateTenant({
          settings_json: { hours: hours.map((d) => (d.closed ? { closed: true } : { closed: false, open: d.open, close: d.close })) },
        } as any);
      } else if (step === 3) {
        await api.updateTenant({
          settings_json: {
            instagram: instagram.trim() || null,
            facebook: facebook.trim() || null,
            x: x.trim() || null,
            tiktok: tiktok.trim() || null,
            youtube: youtube.trim() || null,
            whatsapp: whatsapp.trim() || null,
            wifi_ssid: wifiSsid.trim() || null,
            wifi_password: wifiPassword.trim() || null,
          },
        } as any);
      } else if (step === 4) {
        await api.updateTenant({ settings_json: { theme } } as any);
      } else if (step === 5) {
        await api.updateTenant({ settings_json: { logo } } as any);
      } else if (step === 6) {
        await api.updateTenant({ settings_json: { cover } } as any);
      } else if (step === 7) {
        await api.updateTenant({
          settings_json: {
            allow_call_waiter: callWaiter,
            allow_on_table_order: onTable,
            allow_takeaway: takeaway,
            allow_delivery: delivery,
            allow_online_payment: online,
          },
        } as any);
      } else if (step === 8) {
        if (!authName.trim()) {
          setError('Yetkili ad soyad gerekli.');
          setBusy(false);
          return;
        }
        await api.updateTenant({
          settings_json: {
            authorized: {
              name: authName.trim(),
              title: authTitle.trim() || null,
              phone: authPhone.trim() || null,
              email: authEmail.trim() || null,
              company: authCompany.trim() || null,
              tax_office: authTaxOffice.trim() || null,
              tax_no: authTaxNo.trim() || null,
            },
            onboarding: { completed: true, step: 9 },
          },
        } as any);
        onDone();
        return;
      }
      setStep((v) => Math.min(STEPS.length - 1, v + 1));
    } catch (err: any) {
      setError(err?.message ?? 'Kaydedilemedi, tekrar deneyin.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4">
      <div className="flex max-h-[88vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-surface shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-line px-6 py-4">
          <div>
            <h2 className="text-lg font-extrabold tracking-tight text-ink">İşletme Kurulumu</h2>
            <p className="text-xs text-muted">Menünüzü yayına hazırlamak için birkaç adım</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Kapat" className="grid h-8 w-8 place-items-center rounded-lg text-muted transition hover:bg-canvas hover:text-ink">
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
          </button>
        </div>

        {/* Step progress dots */}
        <div className="flex items-center gap-1.5 px-6 pt-4">
          {STEPS.map((_, i) => (
            <span key={i} className={`h-1.5 flex-1 rounded-full transition-all ${i <= step ? 'bg-brand-500' : 'bg-line'}`} />
          ))}
        </div>

        {/* Body */}
        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
          {error && <div className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

          {step === 0 && (
            <div className="space-y-4">
              <Field label="İşletme Adı" required>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Örn. Sahil Restoran" />
              </Field>
              <Field label="İşletme Türü" required>
                <div className="grid gap-2 sm:grid-cols-2">
                  {VERTICALS.map(([val, label, hint]) => {
                    const locked = allowedVerticals ? !allowedVerticals.includes(val) : false;
                    return (
                      <button
                        key={val}
                        type="button"
                        disabled={locked}
                        onClick={() => setVertical(val)}
                        title={locked ? 'Bu tür planınızda yok — yükseltin' : undefined}
                        className={`rounded-lg border px-3 py-2 text-left transition ${
                          vertical === val ? 'border-brand-500 bg-brand-50 ring-2 ring-brand-200' : locked ? 'cursor-not-allowed border-line bg-canvas opacity-50' : 'border-line hover:border-brand-300'
                        }`}
                      >
                        <span className="block text-sm font-semibold text-ink">{label}{locked ? ' 🔒' : ''}</span>
                        <span className="mt-0.5 block text-[11px] leading-tight text-muted">{hint}</span>
                      </button>
                    );
                  })}
                </div>
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Ülke" hint="Saat dilimi ve dil otomatik ayarlanır.">
                  <div className="relative">
                    <select
                      value={country}
                      onChange={(e) => onCountry(e.target.value)}
                      className="w-full appearance-none rounded-lg border border-line bg-white px-3 py-2.5 text-sm text-ink outline-none transition focus:border-brand-500"
                    >
                      <option value="">Ülke seçin…</option>
                      {countries.map((c) => (
                        <option key={c.code} value={c.code}>{c.flag} {c.name}</option>
                      ))}
                    </select>
                    <svg viewBox="0 0 24 24" className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6" /></svg>
                  </div>
                </Field>
                <Field label="Para Birimi" required hint="Menüde fiyatlar bu birimle gösterilir.">
                  <div className="relative">
                    <select
                      value={currency}
                      onChange={(e) => setCurrency(e.target.value)}
                      className="w-full appearance-none rounded-lg border border-line bg-white px-3 py-2.5 text-sm text-ink outline-none transition focus:border-brand-500"
                    >
                      {currencies.map((c) => (
                        <option key={c.code} value={c.code}>{c.code} — {c.name}</option>
                      ))}
                    </select>
                    <svg viewBox="0 0 24 24" className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6" /></svg>
                  </div>
                </Field>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Varsayılan Dil" required hint="Menü ilk bu dilde açılır.">
                  <div className="relative">
                    <select
                      value={locale}
                      onChange={(e) => setLocale(e.target.value)}
                      className="w-full appearance-none rounded-lg border border-line bg-white px-3 py-2.5 text-sm text-ink outline-none transition focus:border-brand-500"
                    >
                      {LOCALES.map(([val, label]) => (
                        <option key={val} value={val}>{label}</option>
                      ))}
                    </select>
                    <svg viewBox="0 0 24 24" className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6" /></svg>
                  </div>
                </Field>
                <Field label="Alt Başlık" hint="Menü başlığının altında görünür.">
                  <Input value={subTitle} onChange={(e) => setSubTitle(e.target.value)} placeholder="Kebap & Mangal" />
                </Field>
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-4">
              <p className="text-sm text-muted">Bu bilgiler menünüzün üst kısmında müşterilere gösterilir. Boş bırakılanlar gizlenir.</p>
              <Field label="Adres">
                <Input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="İşletme adresi" />
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Telefon">
                  <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+90 5xx xxx xx xx" />
                </Field>
                <Field label="E-posta">
                  <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="info@restoran.com" />
                </Field>
                <Field label="Web Sitesi">
                  <Input value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="restoran.com" />
                </Field>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-3">
              <p className="text-sm text-muted">Menüde “Açık / Kapalı” durumu ve günlük saatler gösterilir.</p>
              {hours.map((d, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="w-20 shrink-0 text-sm text-ink">{DAY_LABELS[i]}</span>
                  <button
                    type="button"
                    onClick={() => setDay(i, { closed: !d.closed })}
                    className={`w-16 shrink-0 rounded-md px-2 py-1 text-xs font-semibold ${d.closed ? 'bg-red-100 text-red-600' : 'bg-emerald-100 text-emerald-700'}`}
                  >
                    {d.closed ? 'Kapalı' : 'Açık'}
                  </button>
                  {d.closed ? (
                    <span className="text-xs text-muted">Kapalı</span>
                  ) : (
                    <div className="flex items-center gap-1.5">
                      <Input type="time" value={d.open} onChange={(e) => setDay(i, { open: e.target.value })} className="w-28" />
                      <span className="text-muted">–</span>
                      <Input type="time" value={d.close} onChange={(e) => setDay(i, { close: e.target.value })} className="w-28" />
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <p className="text-sm text-muted">Sosyal medya ve misafir WiFi — girilirse menüde gösterilir.</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Instagram"><Input value={instagram} onChange={(e) => setInstagram(e.target.value)} placeholder="@kullaniciadi" /></Field>
                <Field label="Facebook"><Input value={facebook} onChange={(e) => setFacebook(e.target.value)} placeholder="facebook.com/sayfa" /></Field>
                <Field label="WhatsApp"><Input value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} placeholder="+90 5xx xxx xx xx" /></Field>
                <Field label="X (Twitter)"><Input value={x} onChange={(e) => setX(e.target.value)} placeholder="@kullaniciadi" /></Field>
                <Field label="TikTok"><Input value={tiktok} onChange={(e) => setTiktok(e.target.value)} placeholder="@kullaniciadi" /></Field>
                <Field label="YouTube"><Input value={youtube} onChange={(e) => setYoutube(e.target.value)} placeholder="youtube.com/@kanal" /></Field>
              </div>
              <div className="grid gap-3 border-t border-line pt-4 sm:grid-cols-2">
                <Field label="WiFi Adı (SSID)"><Input value={wifiSsid} onChange={(e) => setWifiSsid(e.target.value)} placeholder="Guest_WiFi" /></Field>
                <Field label="WiFi Şifresi"><Input value={wifiPassword} onChange={(e) => setWifiPassword(e.target.value)} placeholder="••••••••" /></Field>
              </div>
            </div>
          )}

          {step === 4 && (
            <div>
              <p className="mb-3 text-sm text-muted">Menünüzün müşterilere görüneceği düzeni seçin. Sonradan Ayarlar’dan değiştirebilirsiniz.</p>
              <div className="grid grid-cols-3 gap-3">
                {THEMES.map(([val, label]) => (
                  <div key={val} className={`overflow-hidden rounded-xl border transition ${theme === val ? 'border-brand-500 ring-2 ring-brand-200' : 'border-line hover:border-brand-300'}`}>
                    <button type="button" onClick={() => setTheme(val)} className="block w-full bg-canvas p-2" title={`${label} temasını seç`}>
                      <ThemeThumb theme={val} />
                    </button>
                    <div className={`py-1.5 text-center text-xs font-semibold ${theme === val ? 'bg-brand-500 text-white' : 'bg-surface text-muted'}`}>{label}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {step === 5 && (
            <div>
              <p className="mb-3 text-sm text-muted">İşletmenizin logosu. Kare olarak menü başlığında görünür — yükleyip konumlandırabilirsiniz.</p>
              <ImageCropperField kind="logo" aspect={1} url={logo} onChange={setLogo} upload={(f) => api.uploadRestaurantMedia('logo', f)} />
            </div>
          )}

          {step === 6 && (
            <div>
              <p className="mb-3 text-sm text-muted">Menünüzün en üstünde görünen geniş kapak görseli. Yükleyip kadrajını ayarlayın.</p>
              <ImageCropperField kind="cover" aspect={3} url={cover} onChange={setCover} upload={(f) => api.uploadRestaurantMedia('cover', f)} />
            </div>
          )}

          {step === 7 && (
            <div className="space-y-1">
              <p className="mb-2 text-sm text-muted">Müşterilerin menüden neler yapabileceğini seçin. Sonradan Ayarlar’dan değiştirebilirsiniz.</p>
              <div className="divide-y divide-line">
                <YesNo label="Garson çağırma (masada)" value={callWaiter} onChange={setCallWaiter} />
                <YesNo label="Masada sipariş" value={onTable} onChange={setOnTable} />
                <YesNo label="Gel-al siparişi" value={takeaway} onChange={setTakeaway} />
                <YesNo label="Teslimat siparişi" value={delivery} onChange={setDelivery} />
                <YesNo label="Online ödeme" value={online} onChange={setOnline} />
              </div>
              {currency && <p className="mt-3 text-xs text-muted">Para birimi: <b className="text-ink">{currency}</b> · Ayarlar’dan detaylandırabilirsiniz.</p>}
            </div>
          )}

          {step === 8 && (
            <div className="space-y-4">
              <p className="text-sm text-muted">İşletmeden sorumlu yetkili ve fatura bilgileri. Bu bilgiler yalnızca yönetim/fatura amacıyla kullanılır, menüde gösterilmez.</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Yetkili Ad Soyad" required>
                  <Input value={authName} onChange={(e) => setAuthName(e.target.value)} placeholder="Ad Soyad" />
                </Field>
                <Field label="Görev / Ünvan">
                  <Input value={authTitle} onChange={(e) => setAuthTitle(e.target.value)} placeholder="İşletme Sahibi" />
                </Field>
                <Field label="Telefon">
                  <Input value={authPhone} onChange={(e) => setAuthPhone(e.target.value)} placeholder="+90 5xx xxx xx xx" />
                </Field>
                <Field label="E-posta">
                  <Input type="email" value={authEmail} onChange={(e) => setAuthEmail(e.target.value)} placeholder="yetkili@restoran.com" />
                </Field>
              </div>
              <div className="grid gap-3 border-t border-line pt-4 sm:grid-cols-2">
                <Field label="Fatura Ünvanı" hint="Yasal şirket/işletme ünvanı (fatura için)">
                  <Input value={authCompany} onChange={(e) => setAuthCompany(e.target.value)} placeholder="Örn. Sahil Turizm Gıda Ltd." />
                </Field>
                <Field label="Vergi Dairesi">
                  <Input value={authTaxOffice} onChange={(e) => setAuthTaxOffice(e.target.value)} placeholder="Lefkoşa" />
                </Field>
                <Field label="Vergi / Kimlik No">
                  <Input value={authTaxNo} onChange={(e) => setAuthTaxNo(e.target.value)} placeholder="1234567890" />
                </Field>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-line px-6 py-4">
          <button
            type="button"
            onClick={() => setStep((v) => Math.max(0, v - 1))}
            disabled={step === 0 || busy}
            className="inline-flex items-center gap-1.5 rounded-lg border border-line px-4 py-2 text-sm font-semibold text-muted transition hover:bg-canvas disabled:cursor-not-allowed disabled:opacity-40"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M11 18l-6-6 6-6" /></svg>
            Geri
          </button>
          <span className="text-xs font-semibold text-muted">{step + 1} / {STEPS.length} · {STEPS[step]}</span>
          <button
            type="button"
            onClick={next}
            disabled={busy}
            className="inline-flex items-center gap-1.5 rounded-lg bg-brand-500 px-5 py-2 text-sm font-bold text-white transition hover:bg-brand-600 disabled:opacity-60"
            style={{ color: '#ffffff' }}
          >
            {busy ? 'Kaydediliyor…' : isLast ? 'Kurulumu Tamamla' : 'İleri'}
            {!isLast && <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6" /></svg>}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, hint, required, children }: { label: string; hint?: string; required?: boolean; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-muted">
        {label}
        {required && <span className="text-red-500"> *</span>}
      </span>
      {children}
      {hint && <span className="mt-1 block text-[11px] text-muted">{hint}</span>}
    </label>
  );
}

function YesNo({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between py-2.5">
      <span className="text-sm text-ink">{label}</span>
      <div className="inline-flex overflow-hidden rounded-lg border border-line">
        {[true, false].map((v) => (
          <button
            key={String(v)}
            type="button"
            onClick={() => onChange(v)}
            className={`px-3 py-1 text-xs font-semibold ${value === v ? (v ? 'bg-emerald-500 text-white' : 'bg-red-500 text-white') : 'bg-white text-muted'}`}
          >
            {v ? 'Evet' : 'Hayır'}
          </button>
        ))}
      </div>
    </div>
  );
}
