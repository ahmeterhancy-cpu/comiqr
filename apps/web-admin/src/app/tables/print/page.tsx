'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { QrSvg, useQrMatrix } from '@/components/qr';
import { useApi } from '@/lib/useApi';

const CUSTOMER_BASE = process.env.NEXT_PUBLIC_CUSTOMER_URL ?? 'http://localhost:3010';

/**
 * Print sheet for every table QR (Faz 4 — routing).
 *
 * A venue with thirty tables is not going to download thirty PNGs; it prints one
 * sheet and cuts. So this page deliberately skips the admin shell — no sidebar,
 * no header — and lays the codes out on A4 with dashed cut lines. The toolbar is
 * screen-only; what reaches the paper is just the labels.
 */
export default function TablesPrintPage() {
  const t = useTranslations('tablesPrint');
  const c = useTranslations('common');
  const { api, ready } = useApi();

  const [tables, setTables] = useState<any[]>([]);
  const [venue, setVenue] = useState<string>('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!ready) return;
    Promise.all([api.adminTables(), api.getTenant()])
      .then(([list, tenant]: [any[], any]) => {
        setTables((list ?? []).filter((x) => x.is_active !== false));
        setVenue(tenant?.name ?? '');
      })
      .catch(() => undefined)
      .finally(() => setLoading(false));
  }, [ready, api]);

  return (
    <div className="min-h-screen bg-canvas print:bg-white">
      <style>{`
        @page { size: A4 portrait; margin: 10mm; }
        @media print {
          .no-print { display: none !important; }
          .qr-card { break-inside: avoid; page-break-inside: avoid; }
        }
      `}</style>

      <div className="no-print sticky top-0 z-10 flex flex-wrap items-center gap-3 border-b border-line bg-surface px-5 py-3 shadow-sm">
        <Link href="/tables" className="text-sm font-semibold text-brand-600 hover:underline">
          ‹ {c('back')}
        </Link>
        <span className="text-sm text-muted">{t('count', { count: tables.length })}</span>
        <button
          type="button"
          onClick={() => window.print()}
          className="ml-auto rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold shadow-sm transition hover:bg-brand-600"
          style={{ color: '#ffffff' }}
        >
          {t('print')}
        </button>
      </div>

      <p className="no-print px-5 pt-4 text-xs text-muted">{t('hint')}</p>

      {loading ? (
        <p className="px-5 py-8 text-sm text-muted">{c('loading')}</p>
      ) : tables.length === 0 ? (
        <p className="px-5 py-8 text-sm text-muted">{t('empty')}</p>
      ) : (
        <div className="grid grid-cols-2 gap-3 p-5 sm:grid-cols-3 print:gap-0 print:p-0">
          {tables.map((table) => (
            <TableLabel key={table.id} table={table} venue={venue} caption={t('scanHint')} />
          ))}
        </div>
      )}
    </div>
  );
}

/** One cut-out label: venue on top, code big under the code, dashed cut border. */
function TableLabel({ table, venue, caption }: { table: any; venue: string; caption: string }) {
  const matrix = useQrMatrix(`${CUSTOMER_BASE}${table.menu_path}`);

  return (
    <div className="qr-card flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-slate-400 bg-white p-4 text-center">
      {venue && <span className="max-w-full truncate text-[11px] font-semibold uppercase tracking-wide text-slate-500">{venue}</span>}
      <QrSvg matrix={matrix} label={table.code} className="h-32 w-32" />
      <span className="text-lg font-bold leading-none text-slate-900">{table.code}</span>
      <span className="text-[11px] text-slate-500">{caption}</span>
    </div>
  );
}
