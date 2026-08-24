'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button, Card, Input } from '@/components/ui';
import { ThemeThumb } from '@/components/ThemeThumb';
import { compressImage } from '@/lib/image';

type Settings = Record<string, any>;

/**
 * Restaurant profile/settings form — shared by the owner's own panel (/settings)
 * and the superadmin "manage restaurant" page. onSave receives the PATCH payload
 * { name, settings_json }.
 */
const THEMES: [string, string][] = [
  ['classic', 'Classic'],
  ['flipbook', 'Flipbook'],
  ['modern', 'Modern'],
];

type DayHours = { closed: boolean; open: string; close: string };
const DAY_KEYS = ['dayMon', 'dayTue', 'dayWed', 'dayThu', 'dayFri', 'daySat', 'daySun'] as const;

const VERTICAL_KEYS: [string, string, string][] = [
  ['restaurant', 'verticalRestaurant', 'verticalRestaurantHint'],
  ['hotel', 'verticalHotel', 'verticalHotelHint'],
  ['beach', 'verticalBeach', 'verticalBeachHint'],
  ['bar', 'verticalBar', 'verticalBarHint'],
];

const CUSTOMER_URL = process.env.NEXT_PUBLIC_CUSTOMER_URL ?? 'http://localhost:3010';

export function RestaurantSettingsForm({
  initialName,
  initialSettings,
  currency,
  slug,
  allowedVerticals,
  whiteLabel,
  happyHour = true,
  onSave,
  onUpload,
}: {
  initialName: string;
  initialSettings?: Settings;
  currency?: string;
  slug?: string;
  /** Verticals the tenant's plan unlocks; others are locked. Undefined → all allowed (superadmin). */
  allowedVerticals?: string[];
  /** Plan unlocks white-label (brand color + hide "Powered by"). */
  whiteLabel?: boolean;
  /** Plan unlocks the bar Happy Hour scheduler. */
  happyHour?: boolean;
  onSave: (payload: Record<string, unknown>) => Promise<unknown>;
  onUpload?: (type: 'logo' | 'cover', file: File) => Promise<{ url: string }>;
}) {
  const t = useTranslations('settings');
  const c = useTranslations('common');
  const DAY_LABELS = DAY_KEYS.map((k) => t(k));
  const VERTICALS: [string, string, string][] = VERTICAL_KEYS.map(([val, label, hint]) => [val, t(label), t(hint)]);
  const s = initialSettings ?? {};
  const [name, setName] = useState(initialName ?? '');
  const [vertical, setVertical] = useState<string>(s.vertical ?? 'restaurant');
  const [theme, setTheme] = useState<string>(s.theme ?? 'classic');
  const [logo, setLogo] = useState<string | null>(s.logo ?? null);
  const [cover, setCover] = useState<string | null>(s.cover ?? null);
  const [uploading, setUploading] = useState<string | null>(null);
  const [subTitle, setSubTitle] = useState<string>(s.sub_title ?? '');
  const [hours, setHours] = useState<DayHours[]>(
    Array.isArray(s.hours) && s.hours.length === 7
      ? s.hours.map((d: any) => ({ closed: !!d?.closed, open: d?.open ?? '09:00', close: d?.close ?? '22:00' }))
      : Array.from({ length: 7 }, (_, i) => ({ closed: i === 6, open: '09:00', close: '22:00' })),
  );
  const setDay = (i: number, patch: Partial<DayHours>) =>
    setHours((prev) => prev.map((d, idx) => (idx === i ? { ...d, ...patch } : d)));
  const [description, setDescription] = useState<string>(s.description ?? '');
  const [address, setAddress] = useState<string>(s.address ?? '');
  const [email, setEmail] = useState<string>(s.email ?? '');
  const [website, setWebsite] = useState<string>(s.website ?? '');
  const [phone, setPhone] = useState<string>(s.phone ?? '');
  const [instagram, setInstagram] = useState<string>(s.instagram ?? '');
  const [facebook, setFacebook] = useState<string>(s.facebook ?? '');
  const [x, setX] = useState<string>(s.x ?? '');
  const [tiktok, setTiktok] = useState<string>(s.tiktok ?? '');
  const [youtube, setYoutube] = useState<string>(s.youtube ?? '');
  const [whatsapp, setWhatsapp] = useState<string>(s.whatsapp ?? '');
  const [wifiSsid, setWifiSsid] = useState<string>(s.wifi_ssid ?? '');
  const [wifiPassword, setWifiPassword] = useState<string>(s.wifi_password ?? '');
  const [callWaiter, setCallWaiter] = useState<boolean>(s.allow_call_waiter ?? true);
  const [onTable, setOnTable] = useState<boolean>(s.allow_on_table_order ?? true);
  const [takeaway, setTakeaway] = useState<boolean>(s.allow_takeaway ?? true);
  const [delivery, setDelivery] = useState<boolean>(s.allow_delivery ?? true);
  const [deliveryCharge, setDeliveryCharge] = useState<string>(String(s.delivery_charge ?? 0));
  const [notify, setNotify] = useState<boolean>(s.order_notification ?? true);
  const [online, setOnline] = useState<boolean>(s.allow_online_payment ?? true);
  const hh = s.happy_hour ?? {};
  const [hhEnabled, setHhEnabled] = useState<boolean>(hh.enabled ?? false);
  const [hhStart, setHhStart] = useState<string>(hh.start ?? '22:00');
  const [hhEnd, setHhEnd] = useState<string>(hh.end ?? '00:00');
  const [hhPercent, setHhPercent] = useState<string>(String(hh.percent ?? 20));
  const [brandColor, setBrandColor] = useState<string>(s.brand_color ?? '#c1502e');
  const [hidePoweredBy, setHidePoweredBy] = useState<boolean>(s.hide_powered_by ?? false);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setBusy(true);
    setSaved(false);
    setError(null);
    try {
      await onSave({
        name: name.trim(),
        settings_json: {
          vertical,
          sub_title: subTitle.trim() || null,
          hours: hours.map((d) => (d.closed ? { closed: true } : { closed: false, open: d.open, close: d.close })),
          description: description.trim() || null,
          address: address.trim() || null,
          email: email.trim() || null,
          website: website.trim() || null,
          phone: phone.trim() || null,
          instagram: instagram.trim() || null,
          facebook: facebook.trim() || null,
          x: x.trim() || null,
          tiktok: tiktok.trim() || null,
          youtube: youtube.trim() || null,
          whatsapp: whatsapp.trim() || null,
          wifi_ssid: wifiSsid.trim() || null,
          wifi_password: wifiPassword.trim() || null,
          allow_call_waiter: callWaiter,
          allow_on_table_order: onTable,
          allow_takeaway: takeaway,
          allow_delivery: delivery,
          delivery_charge: Number(deliveryCharge || 0),
          order_notification: notify,
          allow_online_payment: online,
          theme,
          logo,
          cover,
          happy_hour: { enabled: hhEnabled, start: hhStart, end: hhEnd, percent: Number(hhPercent || 0) },
          ...(whiteLabel ? { brand_color: brandColor, hide_powered_by: hidePoweredBy } : {}),
        },
      });
      setSaved(true);
    } catch {
      setError(t('saveFailed'));
    } finally {
      setBusy(false);
    }
  }

  async function upload(type: 'logo' | 'cover', file: File) {
    if (!onUpload) return;
    setUploading(type);
    setError(null);
    try {
      // Shrink big uploads before they hit the server's upload_max_filesize.
      // Logo → PNG (keep transparency, 512px); cover → JPEG (1500px wide).
      const optimized =
        type === 'logo'
          ? await compressImage(file, { maxSize: 512, format: 'png' })
          : await compressImage(file, { maxSize: 1500, format: 'jpeg' });
      const res = await onUpload(type, optimized);
      if (type === 'logo') setLogo(res.url);
      else setCover(res.url);
    } catch {
      setError(t('uploadFailed'));
    } finally {
      setUploading(null);
    }
  }

  return (
    <div className="space-y-5">
      <Card>
        <h3 className="mb-3 text-sm font-semibold text-ink">{t('restaurantInfo')}</h3>
        <div className="space-y-3">
          <Field label={t('restaurantName')}>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
          <Field label={t('businessType')}>
            <div className="grid gap-2 sm:grid-cols-2">
              {VERTICALS.map(([val, label, hint]) => {
                const locked = allowedVerticals ? !allowedVerticals.includes(val) : false;
                return (
                  <button
                    key={val}
                    type="button"
                    disabled={locked}
                    onClick={() => setVertical(val)}
                    title={locked ? t('verticalLocked') : undefined}
                    className={`rounded-lg border px-3 py-2 text-left transition ${
                      vertical === val
                        ? 'border-brand-500 bg-brand-50 ring-2 ring-brand-200'
                        : locked
                          ? 'cursor-not-allowed border-line bg-canvas opacity-50'
                          : 'border-line hover:border-brand-300'
                    }`}
                  >
                    <span className="block text-sm font-semibold text-ink">
                      {label}
                      {locked ? ' 🔒' : ''}
                    </span>
                    <span className="mt-0.5 block text-[11px] leading-tight text-muted">{hint}</span>
                  </button>
                );
              })}
            </div>
          </Field>
          <Field label={t('subTitle')}>
            <Input value={subTitle} onChange={(e) => setSubTitle(e.target.value)} placeholder={t('subTitlePlaceholder')} />
          </Field>
          <Field label={t('workingHours')}>
            <div className="space-y-1.5">
              {hours.map((d, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="w-20 shrink-0 text-sm text-ink">{DAY_LABELS[i]}</span>
                  <button
                    type="button"
                    onClick={() => setDay(i, { closed: !d.closed })}
                    className={`w-16 shrink-0 rounded-md px-2 py-1 text-xs font-semibold ${
                      d.closed ? 'bg-red-100 text-red-600' : 'bg-emerald-100 text-emerald-700'
                    }`}
                  >
                    {d.closed ? t('closed') : t('open')}
                  </button>
                  {d.closed ? (
                    <span className="text-xs text-muted">{t('closed')}</span>
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
            <p className="mt-1.5 text-[11px] text-muted">{t('hoursHint')}</p>
          </Field>
          <Field label={c('description')}>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full rounded-lg border border-line bg-white px-3 py-2 text-sm outline-none focus:border-brand-500"
            />
          </Field>
          <Field label={t('address')}>
            <Input value={address} onChange={(e) => setAddress(e.target.value)} placeholder={t('addressPlaceholder')} />
          </Field>
        </div>
      </Card>

      <Card>
        <h3 className="mb-1 text-sm font-semibold text-ink">{t('contactSocial')}</h3>
        <p className="mb-3 text-xs text-muted">{t('contactHint')}</p>
        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={t('email')}>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder={t('emailPlaceholder')} />
            </Field>
            <Field label={t('website')}>
              <Input value={website} onChange={(e) => setWebsite(e.target.value)} placeholder={t('websitePlaceholder')} />
            </Field>
            <Field label={t('phone')}>
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder={t('phonePlaceholder')} />
            </Field>
            <Field label="WhatsApp">
              <Input value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} placeholder={t('phonePlaceholder')} />
            </Field>
            <Field label="Instagram">
              <Input value={instagram} onChange={(e) => setInstagram(e.target.value)} placeholder={t('usernamePlaceholder')} />
            </Field>
            <Field label="Facebook">
              <Input value={facebook} onChange={(e) => setFacebook(e.target.value)} placeholder={t('facebookPlaceholder')} />
            </Field>
            <Field label="X (Twitter)">
              <Input value={x} onChange={(e) => setX(e.target.value)} placeholder={t('usernamePlaceholder')} />
            </Field>
            <Field label="TikTok">
              <Input value={tiktok} onChange={(e) => setTiktok(e.target.value)} placeholder={t('usernamePlaceholder')} />
            </Field>
            <Field label="YouTube">
              <Input value={youtube} onChange={(e) => setYoutube(e.target.value)} placeholder={t('youtubePlaceholder')} />
            </Field>
          </div>
        </div>
      </Card>

      <Card>
        <h3 className="mb-1 text-sm font-semibold text-ink">{t('guestWifi')}</h3>
        <p className="mb-3 text-xs text-muted">{t('wifiHint')}</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={t('wifiName')}>
            <Input value={wifiSsid} onChange={(e) => setWifiSsid(e.target.value)} placeholder="Guest_WiFi" />
          </Field>
          <Field label={t('wifiPassword')}>
            <Input value={wifiPassword} onChange={(e) => setWifiPassword(e.target.value)} placeholder="••••••••" />
          </Field>
        </div>
      </Card>

      <Card>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-ink">{t('appearanceTheme')}</h3>
          <span className="text-xs text-muted">{t('menuLayout')}</span>
        </div>
        <div className="mb-3 grid grid-cols-3 gap-3">
          {THEMES.map(([val, label]) => (
            <div
              key={val}
              className={`overflow-hidden rounded-xl border transition ${
                theme === val ? 'border-brand-500 ring-2 ring-brand-200' : 'border-line hover:border-brand-300'
              }`}
            >
              <button type="button" onClick={() => setTheme(val)} className="block w-full bg-canvas p-2" title={t('selectTheme', { theme: label })}>
                <ThemeThumb theme={val} />
              </button>
              <div
                className={`flex items-center justify-center gap-2 py-1.5 text-xs font-semibold ${
                  theme === val ? 'bg-brand-500 text-white' : 'bg-surface text-muted'
                }`}
              >
                <span>{label}</span>
                {slug && (
                  <a
                    href={`${CUSTOMER_URL}/${slug}?theme=${val}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={theme === val ? 'underline opacity-90' : 'text-brand-600 hover:underline'}
                  >
                    ↗
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
        {slug && (
          <p className="mb-4 text-xs text-muted">
            {t.rich('themeHint', { b: (chunks) => <b>{chunks}</b> })}
          </p>
        )}
        {onUpload && (
          <div className="grid gap-4 sm:grid-cols-2">
            <ImageUpload label={t('logo')} url={logo} busy={uploading === 'logo'} onPick={(f) => upload('logo', f)} />
            <ImageUpload label={t('coverImage')} url={cover} busy={uploading === 'cover'} onPick={(f) => upload('cover', f)} wide />
          </div>
        )}
      </Card>

      <Card>
        <h3 className="mb-3 text-sm font-semibold text-ink">{t('orderPayment')}</h3>
        <div className="divide-y divide-line">
          <YesNo label={t('callWaiter')} value={callWaiter} onChange={setCallWaiter} />
          <YesNo label={t('onTableOrder')} value={onTable} onChange={setOnTable} />
          <YesNo label={t('takeawayOrder')} value={takeaway} onChange={setTakeaway} />
          <YesNo label={t('deliveryOrder')} value={delivery} onChange={setDelivery} />
          {delivery && (
            <div className="flex items-center justify-between py-2.5">
              <span className="text-sm text-ink">{t('deliveryCharge')}{currency ? ` (${currency})` : ''}</span>
              <Input
                type="number"
                className="w-28 text-right"
                value={deliveryCharge}
                onChange={(e) => setDeliveryCharge(e.target.value)}
              />
            </div>
          )}
          <YesNo label={t('newOrderNotification')} value={notify} onChange={setNotify} />
          <YesNo label={t('onlinePayment')} value={online} onChange={setOnline} />
        </div>
      </Card>

      {vertical === 'bar' && happyHour && (
        <Card>
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-ink">Happy Hour</h3>
            <span className="text-xs text-muted">Bar</span>
          </div>
          <YesNo label={t('happyHourDiscount')} value={hhEnabled} onChange={setHhEnabled} />
          {hhEnabled && (
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              <Field label={t('startTime')}>
                <Input type="time" value={hhStart} onChange={(e) => setHhStart(e.target.value)} />
              </Field>
              <Field label={t('endTime')}>
                <Input type="time" value={hhEnd} onChange={(e) => setHhEnd(e.target.value)} />
              </Field>
              <Field label={t('discountPercent')}>
                <Input type="number" value={hhPercent} onChange={(e) => setHhPercent(e.target.value)} />
              </Field>
            </div>
          )}
          <p className="mt-2 text-xs text-muted">
            {t('happyHourHint')}
          </p>
        </Card>
      )}

      {whiteLabel && (
        <Card>
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-ink">White-label</h3>
            <span className="text-xs text-muted">Enterprise</span>
          </div>
          <div className="space-y-3">
            <Field label={t('brandColor')}>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={brandColor}
                  onChange={(e) => setBrandColor(e.target.value)}
                  className="h-9 w-12 cursor-pointer rounded border border-line bg-white"
                />
                <Input value={brandColor} onChange={(e) => setBrandColor(e.target.value)} className="w-32" />
              </div>
            </Field>
            <YesNo label={t('hidePoweredBy')} value={hidePoweredBy} onChange={setHidePoweredBy} />
          </div>
        </Card>
      )}

      <div className="flex items-center gap-3">
        <Button onClick={save} disabled={busy}>
          {busy ? c('saving') : c('save')}
        </Button>
        {saved && <span className="text-sm font-medium text-emerald-700">✓ {c('saved')}</span>}
        {error && <span className="text-sm text-red-600">{error}</span>}
      </div>
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

/** A tiny illustrative mockup of each menu theme (no photos needed). */
function ImageUpload({
  label,
  url,
  busy,
  onPick,
  wide,
}: {
  label: string;
  url: string | null;
  busy: boolean;
  onPick: (file: File) => void;
  wide?: boolean;
}) {
  const t = useTranslations('settings');
  const c = useTranslations('common');
  return (
    <div>
      <span className="mb-1 block text-xs font-medium text-muted">{label}</span>
      <div className={`mb-2 overflow-hidden rounded-lg border border-line bg-canvas ${wide ? 'aspect-[3/1]' : 'aspect-square max-w-[120px]'}`}>
        {url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt={label} className="h-full w-full object-cover" />
        ) : (
          <div className="grid h-full place-items-center text-xs text-muted">—</div>
        )}
      </div>
      <label className="inline-block cursor-pointer rounded-md border border-line px-3 py-1.5 text-xs font-medium text-muted hover:bg-canvas">
        {busy ? c('loading') : t('uploadImage')}
        <input
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => e.target.files?.[0] && onPick(e.target.files[0])}
        />
      </label>
    </div>
  );
}

function YesNo({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  const c = useTranslations('common');
  return (
    <div className="flex items-center justify-between py-2.5">
      <span className="text-sm text-ink">{label}</span>
      <div className="inline-flex overflow-hidden rounded-lg border border-line">
        {[true, false].map((v) => (
          <button
            key={String(v)}
            type="button"
            onClick={() => onChange(v)}
            className={`px-3 py-1 text-xs font-semibold ${
              value === v ? (v ? 'bg-emerald-500 text-white' : 'bg-red-500 text-white') : 'bg-white text-muted'
            }`}
          >
            {v ? c('yes') : c('no')}
          </button>
        ))}
      </div>
    </div>
  );
}
