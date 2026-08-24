'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import type { AreaType, DiningArea } from '@comiqr/shared-types';
import { AdminShell } from '@/components/AdminShell';
import { QrSvg, downloadQrPng, downloadQrSvg, useQrMatrix } from '@/components/qr';
import { Button, Card, Input } from '@/components/ui';
import { useApi } from '@/lib/useApi';

const CUSTOMER_BASE = process.env.NEXT_PUBLIC_CUSTOMER_URL ?? 'http://localhost:3010';

const AREA_TYPES: { value: AreaType; label: string; icon: string }[] = [
  { value: 'table', label: 'Masa', icon: '🍽️' },
  { value: 'room', label: 'Oda', icon: '🛏️' },
  { value: 'sunbed', label: 'Şezlong', icon: '⛱️' },
  { value: 'stand', label: 'Stant', icon: '🧺' },
];
const areaMeta = (t?: string) => AREA_TYPES.find((a) => a.value === t) ?? AREA_TYPES[0];

const AREA_TYPE_KEY: Record<string, string> = {
  table: 'areaTypeTable',
  room: 'areaTypeRoom',
  sunbed: 'areaTypeSunbed',
  stand: 'areaTypeStand',
};

export default function TablesPage() {
  const t = useTranslations('tables');
  const c = useTranslations('common');
  const atLabel = (v?: string) => t(AREA_TYPE_KEY[areaMeta(v).value]);
  const { api, ready } = useApi();
  const [tables, setTables] = useState<any[]>([]);
  const [areas, setAreas] = useState<DiningArea[]>([]);
  const [code, setCode] = useState('');
  const [areaId, setAreaId] = useState<number | ''>('');
  const [newAreaName, setNewAreaName] = useState('');
  const [newAreaType, setNewAreaType] = useState<AreaType>('table');

  const load = useCallback(async () => {
    const [t, a] = await Promise.all([api.adminTables(), api.adminDiningAreas()]);
    setTables(t);
    setAreas(a);
  }, [api]);

  useEffect(() => {
    if (ready) load();
  }, [ready, load]);

  async function addArea(e: React.FormEvent) {
    e.preventDefault();
    if (!newAreaName.trim()) return;
    await api.createDiningArea({ name: newAreaName.trim(), type: newAreaType });
    setNewAreaName('');
    setNewAreaType('table');
    load();
  }

  async function removeArea(id: number) {
    if (!window.confirm(t('confirmDeleteArea'))) return;
    await api.deleteDiningArea(id);
    load();
  }

  async function addTable(e: React.FormEvent) {
    e.preventDefault();
    if (!code.trim()) return;
    await api.createTable({ code: code.trim(), dining_area_id: areaId || undefined });
    setCode('');
    load();
  }

  async function bulk() {
    const meta = areaMeta(areas.find((a) => a.id === areaId)?.type);
    await api.bulkTables({ count: 5, prefix: meta.label, dining_area_id: areaId || undefined });
    load();
  }

  // Group tables by their area (unassigned last).
  const groups = useMemo(() => {
    const byArea = new Map<number | 'none', any[]>();
    for (const t of tables) {
      const key = t.area?.id ?? ('none' as const);
      byArea.set(key, [...(byArea.get(key) ?? []), t]);
    }
    const ordered: { area: DiningArea | null; items: any[] }[] = areas
      .filter((a) => byArea.has(a.id))
      .map((a) => ({ area: a, items: byArea.get(a.id)! }));
    if (byArea.has('none')) ordered.push({ area: null, items: byArea.get('none')! });
    return ordered;
  }, [tables, areas]);

  return (
    <AdminShell title={t('title')}>
      <div className="grid gap-5 lg:grid-cols-2">
        {/* Areas */}
        <Card>
          <h3 className="mb-3 text-sm font-semibold text-ink">{t('areasHeading')}</h3>
          <form onSubmit={addArea} className="flex flex-wrap gap-2">
            <Input
              placeholder={t('areaNamePlaceholder')}
              value={newAreaName}
              onChange={(e) => setNewAreaName(e.target.value)}
              className="min-w-[9rem] flex-1"
            />
            <select
              value={newAreaType}
              onChange={(e) => setNewAreaType(e.target.value as AreaType)}
              className="rounded-lg border border-line bg-white px-3 text-sm text-ink"
            >
              {AREA_TYPES.map((at) => (
                <option key={at.value} value={at.value}>
                  {at.icon} {atLabel(at.value)}
                </option>
              ))}
            </select>
            <Button type="submit">{t('addArea')}</Button>
          </form>
          <ul className="mt-3 divide-y divide-line">
            {areas.length === 0 && <li className="py-2 text-sm text-muted">{t('noAreas')}</li>}
            {areas.map((a) => {
              const m = areaMeta(a.type);
              return (
                <li key={a.id} className="flex items-center justify-between py-2">
                  <span className="text-sm text-ink">
                    <span className="mr-1.5">{m.icon}</span>
                    {a.name}
                    <span className="ml-2 rounded-full bg-canvas px-2 py-0.5 text-xs text-muted">{atLabel(a.type)}</span>
                    <span className="ml-1 text-xs text-muted">· {t('points', { count: a.tables_count ?? 0 })}</span>
                  </span>
                  <button onClick={() => removeArea(a.id)} className="text-xs font-medium text-red-600 hover:underline">
                    {c('delete')}
                  </button>
                </li>
              );
            })}
          </ul>
        </Card>

        {/* Add point (table/room/sunbed/stand) */}
        <Card>
          <h3 className="mb-3 text-sm font-semibold text-ink">{t('addPointHeading')}</h3>
          <form onSubmit={addTable} className="space-y-2">
            <div className="flex flex-wrap gap-2">
              <Input
                placeholder={t('codePlaceholder')}
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className="min-w-[9rem] flex-1"
              />
              <select
                value={areaId}
                onChange={(e) => setAreaId(e.target.value ? Number(e.target.value) : '')}
                className="rounded-lg border border-line bg-white px-3 text-sm text-ink"
              >
                <option value="">{t('unassigned')}</option>
                {areas.map((a) => (
                  <option key={a.id} value={a.id}>
                    {areaMeta(a.type).icon} {a.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex gap-2">
              <Button type="submit">{c('add')}</Button>
              <Button type="button" variant="ghost" onClick={bulk}>
                {t('generateFive')}
              </Button>
            </div>
          </form>
          <Link
            href="/tables/print"
            className="mt-3 inline-flex items-center justify-center gap-2 rounded-lg border border-line bg-white px-4 py-2.5 text-sm font-semibold text-ink transition hover:bg-canvas"
          >
            {t('printAll')}
          </Link>
          <p className="mt-2 text-xs text-muted">
            {t('pointHint')}
          </p>
        </Card>
      </div>

      {groups.map(({ area, items }) => {
        const m = areaMeta(area?.type);
        return (
          <section key={area?.id ?? 'none'} className="mt-6">
            <h3 className="mb-3 text-sm font-semibold text-ink">
              <span className="mr-1.5">{m.icon}</span>
              {area?.name ?? t('unassigned')}
              <span className="ml-2 text-xs font-normal text-muted">{t('points', { count: items.length })}</span>
            </h3>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {items.map((t) => (
                <TableQrCard key={t.id} table={t} />
              ))}
            </div>
          </section>
        );
      })}
    </AdminShell>
  );
}

/**
 * One service point: its code, its QR and the link behind it. The QR leads
 * because it is the thing that actually goes on the table; the URL underneath is
 * there for checking and for pasting into a print layout.
 */
function TableQrCard({ table }: { table: any }) {
  const t = useTranslations('tables');
  const c = useTranslations('common');
  const q = useTranslations('qr');

  const url = `${CUSTOMER_BASE}${table.menu_path}`;
  const matrix = useQrMatrix(url);
  const meta = areaMeta(table.area?.type);
  const fileBase = `comiqr-${String(table.code).replace(/[^a-zA-Z0-9-_]+/g, '-').toLowerCase()}`;

  return (
    <Card>
      <div className="flex items-center justify-between">
        <span className="font-semibold text-ink">
          {meta.icon} {table.code}
        </span>
        <span className={`text-xs ${table.is_active ? 'text-emerald-700' : 'text-muted'}`}>
          {table.is_active ? c('active') : c('inactive')}
        </span>
      </div>

      <div className="mt-3 flex items-start gap-3">
        <QrSvg
          matrix={matrix}
          label={t('qrAlt', { code: table.code })}
          className="h-24 w-24 shrink-0 rounded-lg border border-line p-1"
        />
        <div className="min-w-0">
          <a
            href={url}
            target="_blank"
            rel="noreferrer"
            className="block break-all text-xs text-brand-600 hover:underline"
          >
            {url}
          </a>
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              onClick={() => downloadQrPng(matrix, `${fileBase}-qr.png`)}
              className="text-xs font-semibold text-brand-600 hover:underline"
            >
              {q('downloadPng')}
            </button>
            <span className="text-xs text-muted">·</span>
            <button
              type="button"
              onClick={() => downloadQrSvg(matrix, `${fileBase}-qr.svg`)}
              className="text-xs font-semibold text-brand-600 hover:underline"
            >
              {q('downloadSvg')}
            </button>
          </div>
        </div>
      </div>
    </Card>
  );
}
