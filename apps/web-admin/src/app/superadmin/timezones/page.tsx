'use client';

import { Panel } from '@/components/superadmin-ui';

const ZONES = [
  { tz: 'Asia/Nicosia', label: 'KKTC / Kıbrıs', note: 'Varsayılan' },
  { tz: 'Europe/Istanbul', label: 'Türkiye' },
  { tz: 'Europe/Berlin', label: 'Orta Avrupa' },
  { tz: 'Europe/London', label: 'Birleşik Krallık' },
  { tz: 'Asia/Dubai', label: 'Körfez' },
];

export default function TimezonesPage() {
  return (
    <Panel title="Saat Dilimleri" right={<span className="text-xs text-muted">Platform genel</span>}>
      <p className="mb-4 text-sm text-muted">
        Sipariş ve rapor tarihleri her işletmenin saat dilimine göre biçimlenir. KKTC için Asia/Nicosia kullanılır.
      </p>
      <ul className="divide-y divide-line text-sm">
        {ZONES.map((z) => (
          <li key={z.tz} className="flex items-center justify-between py-2.5">
            <div>
              <span className="font-medium text-ink">{z.label}</span>
              <span className="ml-2 font-mono text-xs text-muted">{z.tz}</span>
            </div>
            {z.note && <span className="text-xs text-brand-600">{z.note}</span>}
          </li>
        ))}
      </ul>
    </Panel>
  );
}
