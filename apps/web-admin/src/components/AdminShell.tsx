'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Brand, Button } from './ui';
import { APP_NAME, createApi } from '@/lib/api';
import { clearSession, getToken } from '@/lib/auth';

const NAV = [
  { key: 'dashboard', href: '/dashboard' },
  { key: 'menu', href: '/menu' },
  { key: 'orders', href: '/orders' },
  { key: 'tables', href: '/tables' },
] as const;

export function AdminShell({ title, children }: { title?: string; children: React.ReactNode }) {
  const nav = useTranslations('nav');
  const pathname = usePathname();
  const router = useRouter();

  function logout() {
    createApi(getToken()).logout().catch(() => undefined);
    clearSession();
    router.replace('/login');
  }

  return (
    <div className="grid min-h-screen grid-cols-[15rem_1fr] max-lg:grid-cols-1">
      <aside className="hidden flex-col border-r border-line bg-surface p-5 lg:flex">
        <Brand name={APP_NAME} />
        <nav className="mt-8 space-y-1">
          {NAV.map((it) => {
            const active = pathname === it.href;
            return (
              <Link
                key={it.key}
                href={it.href}
                className={`block rounded-lg px-3 py-2 text-sm ${
                  active ? 'bg-brand-50 font-semibold text-brand-700' : 'text-muted hover:bg-canvas'
                }`}
              >
                {nav(it.key as never)}
              </Link>
            );
          })}
        </nav>
        <div className="mt-auto">
          <Button variant="ghost" className="w-full" onClick={logout}>
            {nav('logout')}
          </Button>
        </div>
      </aside>

      <main className="bg-canvas p-6 lg:p-10">
        {title && <h1 className="mb-6 text-2xl font-bold text-ink">{title}</h1>}
        {children}
      </main>
    </div>
  );
}
