'use client';

import { Panel } from '@/components/superadmin-ui';

const CURRENCIES = [
  { code: 'TRY', name: 'Türk Lirası', symbol: '₺' },
  { code: 'EUR', name: 'Euro', symbol: '€' },
  { code: 'USD', name: 'ABD Doları', symbol: '$' },
  { code: 'GBP', name: 'İngiliz Sterlini', symbol: '£' },
];

export default function CurrenciesPage() {
  return (
    <Panel title="Para Birimleri" right={<span className="text-xs text-muted">Platform genel</span>}>
      <p className="mb-4 text-sm text-muted">
        Her işletme kendi para birimini seçer; fiyatlar ve raporlar o birimde gösterilir.
      </p>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {CURRENCIES.map((c) => (
          <div key={c.code} className="rounded-lg border border-line px-3 py-3 text-center">
            <div className="text-2xl font-semibold text-ink">{c.symbol}</div>
            <div className="mt-1 text-sm font-medium text-ink">{c.code}</div>
            <div className="text-xs text-muted">{c.name}</div>
          </div>
        ))}
      </div>
    </Panel>
  );
}
