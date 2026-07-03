'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Brand, Button } from './ui';
import { APP_NAME, createApi } from '@/lib/api';
import { clearSession, getImpersonator, getToken, getUser, returnToImpersonator } from '@/lib/auth';
import { getActiveBranchId, setActiveBranchId } from '@/lib/branch';

const NAV = [
  { key: 'dashboard', href: '/dashboard' },
  { key: 'menu', href: '/menu' },
  { key: 'ingredients', href: '/ingredients' },
  { key: 'orders', href: '/orders' },
  { key: 'pos', href: '/pos' },
  { key: 'tables', href: '/tables' },
  { key: 'branches', href: '/branches' },
  { key: 'customers', href: '/customers' },
  { key: 'reviews', href: '/reviews' },
  { key: 'coupons', href: '/coupons' },
  { key: 'campaigns', href: '/campaigns' },
  { key: 'integrations', href: '/integrations' },
  { key: 'settings', href: '/settings' },
] as const;

export function AdminShell({ title, children }: { title?: string; children: React.ReactNode }) {
  const nav = useTranslations('nav');
  const pathname = usePathname();
  const router = useRouter();
  const [branches, setBranches] = useState<any[]>([]);
  const [activeBranch, setActive] = useState<number | null>(null);
  const [impersonating, setImpersonating] = useState(false);
  const [currentName, setCurrentName] = useState<string>('');
  const [vertical, setVertical] = useState<string>('restaurant');

  useEffect(() => {
    setImpersonating(!!getImpersonator());
    setCurrentName(getUser()?.name ?? '');
  }, []);

  function returnToSuper() {
    if (returnToImpersonator()) window.location.href = '/superadmin';
  }

  useEffect(() => {
    createApi(getToken())
      .adminBranches()
      .then((bs) => {
        setBranches(bs);
        const current = getActiveBranchId() ?? bs[0]?.id ?? null;
        if (current) setActiveBranchId(current);
        setActive(current);
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    createApi(getToken())
      .getTenant()
      .then((t: any) => setVertical(t?.settings?.vertical ?? 'restaurant'))
      .catch(() => undefined);
  }, []);

  function switchBranch(id: number) {
    setActiveBranchId(id);
    setActive(id);
    window.location.reload();
  }

  // Hotel / beach-club tenants get a front-desk "Folio" entry before Settings.
  const navItems: { key: string; href: string }[] = NAV.map((n) => ({ key: n.key, href: n.href }));
  if (['hotel', 'beach'].includes(vertical)) {
    const at = navItems.findIndex((i) => i.href === '/settings');
    navItems.splice(at < 0 ? navItems.length : at, 0, { key: 'hotel', href: '/hotel' });
  }

  function logout() {
    createApi(getToken()).logout().catch(() => undefined);
    clearSession();
    router.replace('/login');
  }

  return (
    <div className="grid min-h-screen grid-cols-[15rem_1fr] max-lg:grid-cols-1">
      <aside className="hidden flex-col border-r border-line bg-surface p-5 lg:flex">
        <Brand name={APP_NAME} />

        {branches.length > 1 && (
          <select
            value={activeBranch ?? ''}
            onChange={(e) => switchBranch(Number(e.target.value))}
            className="mt-5 w-full rounded-lg border border-line bg-canvas px-3 py-2 text-sm text-ink"
          >
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        )}

        <nav className="mt-6 space-y-1">
          {navItems.map((it) => {
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
        {impersonating && (
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
            <span className="text-sm text-amber-900">
              🔓 <b>{currentName || 'Bir işletme'}</b> paneline süper admin olarak giriş yaptınız.
            </span>
            <button
              onClick={returnToSuper}
              className="rounded-lg bg-ink px-3 py-1.5 text-xs font-semibold text-white transition hover:opacity-90"
            >
              ← Süper admin&apos;e dön
            </button>
          </div>
        )}
        {title && <h1 className="mb-6 text-2xl font-bold text-ink">{title}</h1>}
        {children}
      </main>
    </div>
  );
}
