'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AuthShell } from '@/components/AuthShell';
import { Button } from '@/components/ui';
import { useApi } from '@/lib/useApi';

// All countries (ISO 3166-1 alpha-2); Turkish names + flags are generated at runtime.
const CODES =
  'AD AE AF AG AI AL AM AO AR AT AU AW AZ BA BB BD BE BF BG BH BI BJ BM BN BO BR BS BT BW BY BZ CA CD CF CG CH CI CL CM CN CO CR CU CV CY CZ DE DJ DK DM DO DZ EC EE EG ER ES ET FI FJ FM FO FR GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GT GU GW GY HK HN HR HT HU ID IE IM IN IQ IR IS IT JE JM JO JP KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MG MH MK ML MM MN MO MQ MR MT MU MV MW MX MY MZ NA NC NE NG NI NL NO NP NR NZ OM PA PE PF PG PH PK PL PR PS PT PW PY QA RE RO RS RU RW SA SB SC SD SE SG SI SK SL SM SN SO SR SS ST SV SY SZ TD TG TH TJ TL TM TN TO TR TT TV TW TZ UA UG US UY UZ VA VC VE VG VI VN VU WS XK YE ZA ZM ZW'.split(
    ' ',
  );

export default function OnboardingPage() {
  const { api, me, ready } = useApi();
  const router = useRouter();
  const [country, setCountry] = useState('');

  const countries = useMemo(() => {
    let dn: Intl.DisplayNames | null = null;
    try {
      dn = new Intl.DisplayNames(['tr'], { type: 'region' });
    } catch {
      dn = null;
    }
    return CODES.map((code) => {
      let name = code;
      try {
        name = dn?.of(code) ?? code;
      } catch {
        name = code;
      }
      const flag = code.replace(/./g, (ch) => String.fromCodePoint(127397 + ch.charCodeAt(0)));
      return { code, flag, name };
    }).sort((a, b) => a.name.localeCompare(b.name, 'tr'));
  }, []);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const firstName = (me?.user.name ?? '').split(' ')[0] || 'hoş geldiniz';

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!country) {
      setError('Lütfen ülkenizi seçin.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await api.setRegion(country);
      router.replace('/dashboard');
    } catch {
      setError('Kaydedilemedi, tekrar deneyin.');
      setBusy(false);
    }
  }

  if (!ready) {
    return <div className="grid min-h-screen place-items-center text-sm text-muted">Yükleniyor…</div>;
  }

  return (
    <AuthShell>
      <div>
        <h1 className="text-2xl font-extrabold leading-tight tracking-tight text-brand-600">
          Merhaba {firstName}, profilinizi tamamlayalım
        </h1>
        <p className="mt-2 text-[15px] leading-relaxed text-muted">
          Hesabınızı doğru bölgesel ayarlarla (para birimi, saat dilimi ve dil) kurmak için ülkenizi seçin.
        </p>

        <form onSubmit={submit} className="mt-7">
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-ink">Ülke <span className="text-red-500">*</span></span>
            <div className="relative">
              <select
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                className="w-full appearance-none rounded-xl border border-line bg-white px-4 py-3 text-sm text-ink outline-none transition focus:border-brand-500 focus:ring-4 focus:ring-brand-100"
              >
                <option value="" disabled>Ülke seçin…</option>
                {countries.map((c) => (
                  <option key={c.code} value={c.code}>{c.flag} {c.name}</option>
                ))}
              </select>
              <svg viewBox="0 0 24 24" className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6" /></svg>
            </div>
          </label>

          {error && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

          <Button type="submit" loading={busy} className="mt-6 w-full py-3">
            {busy ? 'Kaydediliyor…' : 'Kurulumu Tamamla'}
          </Button>
        </form>

        <button type="button" onClick={() => router.replace('/dashboard')} className="mt-3 w-full text-center text-sm font-medium text-muted transition hover:text-ink">
          Şimdilik atla
        </button>
      </div>
    </AuthShell>
  );
}
