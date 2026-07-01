'use client';

import { useTranslations } from 'next-intl';
import { Brand } from './ui';
import { APP_NAME } from '@/lib/api';

/** Split auth layout: brand/value panel + form card. Light, professional. */
export function AuthShell({ children }: { children: React.ReactNode }) {
  const t = useTranslations('app');

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <aside className="relative hidden flex-col justify-between bg-brand-600 p-12 text-white lg:flex">
        <Brand name={APP_NAME} />
        <div className="max-w-md">
          <h1 className="text-3xl font-bold leading-tight">{t('tagline')}</h1>
          <ul className="mt-8 space-y-3 text-brand-100">
            <li className="flex items-center gap-3">
              <Dot /> Reçete → otomatik kalori, makro ve alerjen
            </li>
            <li className="flex items-center gap-3">
              <Dot /> Scan → sipariş → mutfak → ödeme tek akışta
            </li>
            <li className="flex items-center gap-3">
              <Dot /> Çok dilli, yerel ödeme, KVKK uyumlu
            </li>
          </ul>
        </div>
        <p className="text-sm text-brand-100/80">© {new Date().getFullYear()} {APP_NAME}</p>
      </aside>

      <main className="flex items-center justify-center bg-canvas p-6">
        <div className="w-full max-w-md">
          <div className="mb-6 lg:hidden">
            <Brand name={APP_NAME} />
          </div>
          {children}
        </div>
      </main>
    </div>
  );
}

function Dot() {
  return <span className="h-1.5 w-1.5 rounded-full bg-white/80" />;
}
