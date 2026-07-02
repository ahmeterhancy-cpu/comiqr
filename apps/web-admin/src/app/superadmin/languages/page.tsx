'use client';

import { Panel } from '@/components/superadmin-ui';

const LANGUAGES = [
  { code: 'tr', name: 'Türkçe', note: 'Varsayılan' },
  { code: 'en', name: 'English', note: 'Fallback' },
  { code: 'de', name: 'Deutsch' },
  { code: 'ru', name: 'Русский' },
  { code: 'ar', name: 'العربية', note: 'RTL' },
];

export default function LanguagesPage() {
  return (
    <Panel title="Diller" right={<span className="text-xs text-muted">Platform genel</span>}>
      <p className="mb-4 text-sm text-muted">
        Menü içeriği çeviri tablosuyla, panel arayüzü next-intl ile yönetilir. Varsayılan Türkçe, fallback zinciri TR → EN.
      </p>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {LANGUAGES.map((l) => (
          <div key={l.code} className="flex items-center justify-between rounded-lg border border-line px-3 py-2.5">
            <div>
              <span className="font-medium text-ink">{l.name}</span>
              <span className="ml-2 rounded bg-canvas px-1.5 py-0.5 font-mono text-xs text-muted">{l.code}</span>
            </div>
            {l.note && <span className="text-xs text-brand-600">{l.note}</span>}
          </div>
        ))}
      </div>
    </Panel>
  );
}
