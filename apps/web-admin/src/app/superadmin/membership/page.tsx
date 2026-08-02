'use client';

import { useCallback, useEffect, useState } from 'react';
import { Panel } from '@/components/superadmin-ui';
import { Button, Input } from '@/components/ui';
import { useApi } from '@/lib/useApi';

const CUR: Record<string, string> = { TRY: '₺', EUR: '€', USD: '$', GBP: '£' };

const VERTICAL_LABELS: Record<string, string> = {
  restaurant: '🍽️ Restoran',
  hotel: '🛏️ Otel',
  beach: '⛱️ Plaj',
  bar: '🍹 Bar',
};

const FEATURES: [string, string][] = [
  ['menu', 'QR Menü'],
  ['qr', 'QR & Masa'],
  ['nutrition_display', 'Kalori gösterimi'],
  ['nutrition_full', 'Tam besin değerleri'],
  ['ordering', 'Online sipariş'],
  ['payments', 'Ödeme'],
  ['kds', 'Mutfak ekranı (KDS)'],
  ['waiter_app', 'Garson uygulaması'],
  ['analytics', 'Analitik'],
  ['ai', 'AI özellikleri'],
  ['ai_advanced', 'Gelişmiş AI'],
  ['pos_integration', 'POS entegrasyonu'],
  ['loyalty', 'Sadakat / CRM'],
  ['multi_branch', 'Çok şube'],
  ['happy_hour', 'Happy Hour (bar)'],
  ['folio', 'Oda/Şezlong folyosu'],
  ['finance', 'Gider · Cari · Kâr raporu'],
  ['printing', 'Yazıcı yönlendirme'],
  ['white_label', 'White-label'],
  ['custom_integration', 'Özel entegrasyon'],
  ['sla', 'SLA'],
];

const LIMITS: [string, string][] = [
  ['branches', 'Şube'],
  ['menu_items', 'Menü ürünü'],
  ['monthly_scans', 'Aylık tarama'],
  ['ai_credits', 'AI kredisi'],
];

const nf = (n: number) => new Intl.NumberFormat('tr-TR').format(n);
const lim = (v: number) => (v === -1 || v == null ? 'Sınırsız' : nf(v));

/** Boolean feature flags for this plan, keyed by every known feature (missing = off). */
const featureState = (p: any): Record<string, boolean> =>
  Object.fromEntries(FEATURES.map(([k]) => [k, !!p.features?.[k]]));
/** Limit values as editable strings; empty string = unlimited (-1). */
const limitState = (p: any): Record<string, string> =>
  Object.fromEntries(LIMITS.map(([k]) => [k, p.limits?.[k] === -1 || p.limits?.[k] == null ? '' : String(p.limits[k])]));

export default function MembershipPage() {
  const { api, ready } = useApi();
  const [plans, setPlans] = useState<any[]>([]);
  const load = useCallback(async () => setPlans(await api.superPlans()), [api]);
  useEffect(() => {
    if (ready) load();
  }, [ready, load]);

  return (
    <Panel title="Üyelik Planları" right={<span className="text-xs text-muted">{plans.length} plan</span>}>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {plans.map((p) => (
          <PlanCard key={p.id} p={p} api={api} onChanged={load} />
        ))}
      </div>
    </Panel>
  );
}

function PlanCard({ p, api, onChanged }: { p: any; api: any; onChanged: () => void }) {
  const [edit, setEdit] = useState(false);
  const [m, setM] = useState(String(p.price_monthly));
  const [y, setY] = useState(String(p.price_yearly));
  const [cur, setCur] = useState(p.currency);
  const [feats, setFeats] = useState<Record<string, boolean>>(() => featureState(p));
  const [verts, setVerts] = useState<string[]>(() => p.features?.verticals ?? ['restaurant']);
  const [limits, setLimits] = useState<Record<string, string>>(() => limitState(p));
  const [busy, setBusy] = useState(false);

  const sym = CUR[p.currency] ?? `${p.currency} `;
  const enabled = FEATURES.filter(([k]) => p.features?.[k]);
  const featured = p.code === 'pro';
  const custom = Number(p.price_monthly) === 0 && p.code === 'enterprise';

  function reset() {
    setM(String(p.price_monthly));
    setY(String(p.price_yearly));
    setCur(p.currency);
    setFeats(featureState(p));
    setVerts(p.features?.verticals ?? ['restaurant']);
    setLimits(limitState(p));
    setEdit(false);
  }
  async function save() {
    setBusy(true);
    try {
      // Keep any feature keys we don't surface (e.g. future flags) intact.
      const features_json = { ...(p.features ?? {}), ...feats, verticals: verts };
      const limits_json = Object.fromEntries(
        LIMITS.map(([k]) => [k, limits[k]?.trim() === '' ? -1 : Number(limits[k])]),
      );
      await api.superUpdatePlan(p.id, {
        price_monthly: Number(m),
        price_yearly: Number(y),
        currency: cur,
        features_json,
        limits_json,
      });
      setEdit(false);
      onChanged();
    } finally {
      setBusy(false);
    }
  }
  async function toggle() {
    await api.superUpdatePlan(p.id, { is_active: !p.is_active });
    onChanged();
  }

  return (
    <div
      className={`flex flex-col rounded-2xl border bg-surface p-5 shadow-[var(--shadow-card)] ${
        featured ? 'border-brand-300 ring-1 ring-brand-200' : 'border-line'
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="text-lg font-semibold text-ink">{p.name}</h3>
          <p className="text-xs text-muted">{p.code}</p>
        </div>
        <button
          onClick={toggle}
          className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
            p.is_active ? 'bg-emerald-100 text-emerald-800' : 'bg-canvas text-muted'
          }`}
        >
          {p.is_active ? 'Aktif' : 'Pasif'}
        </button>
      </div>

      {featured && (
        <span className="mt-2 w-fit rounded-full bg-brand-500 px-2 py-0.5 text-[10px] font-semibold text-white">
          En popüler
        </span>
      )}

      {edit ? (
        <div className="mt-4 space-y-2">
          <label className="block text-xs text-muted">
            Aylık ({CUR[cur] ?? cur})
            <Input type="number" value={m} onChange={(e) => setM(e.target.value)} className="mt-1 w-full text-right" />
          </label>
          <label className="block text-xs text-muted">
            Yıllık ({CUR[cur] ?? cur})
            <Input type="number" value={y} onChange={(e) => setY(e.target.value)} className="mt-1 w-full text-right" />
          </label>
          <label className="block text-xs text-muted">
            Para birimi
            <select
              value={cur}
              onChange={(e) => setCur(e.target.value)}
              className="mt-1 w-full rounded-lg border border-line bg-white px-2 py-2 text-sm"
            >
              {Object.keys(CUR).map((c) => (
                <option key={c} value={c}>
                  {c} ({CUR[c]})
                </option>
              ))}
            </select>
          </label>

          {/* Feature gating — toggle which modules this plan unlocks. */}
          <div className="mt-3 border-t border-line pt-3">
            <span className="text-[11px] font-medium uppercase tracking-wide text-muted">Özellikler</span>
            <div className="mt-1.5 space-y-1">
              {FEATURES.map(([k, label]) => (
                <label key={k} className="flex cursor-pointer items-center gap-2 text-sm text-ink">
                  <input
                    type="checkbox"
                    checked={!!feats[k]}
                    onChange={(e) => setFeats((f) => ({ ...f, [k]: e.target.checked }))}
                    className="h-4 w-4 shrink-0 accent-brand-500"
                  />
                  {label}
                </label>
              ))}
            </div>
          </div>

          {/* Which venue types (verticals) can use this plan. */}
          <div className="mt-3 border-t border-line pt-3">
            <span className="text-[11px] font-medium uppercase tracking-wide text-muted">İşletme türleri</span>
            <div className="mt-1.5 space-y-1">
              {Object.entries(VERTICAL_LABELS).map(([k, label]) => (
                <label key={k} className="flex cursor-pointer items-center gap-2 text-sm text-ink">
                  <input
                    type="checkbox"
                    checked={verts.includes(k)}
                    onChange={(e) =>
                      setVerts((vs) => (e.target.checked ? [...new Set([...vs, k])] : vs.filter((v) => v !== k)))
                    }
                    className="h-4 w-4 shrink-0 accent-brand-500"
                  />
                  {label}
                </label>
              ))}
            </div>
          </div>

          {/* Numeric limits — leave blank for unlimited. */}
          <div className="mt-3 border-t border-line pt-3">
            <span className="text-[11px] font-medium uppercase tracking-wide text-muted">Limitler</span>
            <p className="mt-0.5 text-[10px] text-muted">Boş bırak = sınırsız</p>
            <div className="mt-1.5 space-y-1.5">
              {LIMITS.map(([k, label]) => (
                <label key={k} className="flex items-center justify-between gap-2 text-xs text-muted">
                  {label}
                  <Input
                    type="number"
                    value={limits[k] ?? ''}
                    placeholder="∞"
                    onChange={(e) => setLimits((l) => ({ ...l, [k]: e.target.value }))}
                    className="w-24 text-right"
                  />
                </label>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="mt-4">
          {custom ? (
            <div className="text-2xl font-bold text-ink">Özel fiyat</div>
          ) : (
            <>
              <div className="flex items-baseline gap-1">
                <span className="text-3xl font-bold text-ink">
                  {sym}
                  {nf(Number(p.price_monthly))}
                </span>
                <span className="text-sm text-muted">/ay</span>
              </div>
              <p className="mt-0.5 text-xs text-muted">
                {Number(p.price_yearly) > 0 ? `${sym}${nf(Number(p.price_yearly))} / yıl` : 'yıllık fiyat yok'}
              </p>
            </>
          )}
        </div>
      )}

      <p className="mt-3 text-xs text-muted">
        <b className="font-semibold text-ink">{p.tenants}</b> işletme kullanıyor
      </p>

      <ul className="mt-4 flex-1 space-y-1.5 border-t border-line pt-4 text-sm">
        {enabled.map(([k, label]) => (
          <li key={k} className="flex items-center gap-2 text-ink">
            <span className="text-emerald-600">✓</span>
            {label}
          </li>
        ))}
        {enabled.length === 0 && <li className="text-muted">—</li>}
      </ul>

      <div className="mt-3 border-t border-line pt-3">
        <span className="text-[11px] font-medium uppercase tracking-wide text-muted">İşletme türleri</span>
        <div className="mt-1.5 flex flex-wrap gap-1">
          {(p.features?.verticals ?? ['restaurant']).map((v: string) => (
            <span key={v} className="rounded bg-brand-50 px-1.5 py-0.5 text-[10px] font-medium text-brand-700">
              {VERTICAL_LABELS[v] ?? v}
            </span>
          ))}
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-x-3 gap-y-1 border-t border-line pt-3 text-xs">
        {LIMITS.map(([k, label]) => (
          <div key={k}>
            <span className="text-muted">{label}: </span>
            <span className="font-medium text-ink">{lim(p.limits?.[k])}</span>
          </div>
        ))}
      </div>

      <div className="mt-4 flex gap-2">
        {edit ? (
          <>
            <Button onClick={save} disabled={busy} className="flex-1">
              {busy ? '…' : 'Kaydet'}
            </Button>
            <Button variant="ghost" onClick={reset}>
              İptal
            </Button>
          </>
        ) : (
          <Button variant="ghost" onClick={() => setEdit(true)} className="flex-1">
            Düzenle
          </Button>
        )}
      </div>
    </div>
  );
}
