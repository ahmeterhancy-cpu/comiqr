'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { SetupGuide } from './SetupGuide';
import { TrialCard } from './TrialCard';
import { createApi } from '@/lib/api';
import { clearSession, getImpersonator, getToken, getUser, returnToImpersonator } from '@/lib/auth';
import { getActiveBranchId, setActiveBranchId } from '@/lib/branch';

type NavLeaf = { key: string; href: string };
type NavNode = NavLeaf | { key: string; children: NavLeaf[] };

const NAV: NavNode[] = [
  { key: 'dashboard', href: '/dashboard' },
  { key: 'menu', href: '/menu' },
  { key: 'ingredients', href: '/ingredients' },
  { key: 'orders', href: '/orders' },
  { key: 'pos', href: '/pos' },
  { key: 'tables', href: '/tables' },
  { key: 'branches', href: '/branches' },
  { key: 'customers', href: '/customers' },
  { key: 'reviews', href: '/reviews' },
  {
    key: 'marketing',
    children: [
      { key: 'coupons', href: '/coupons' },
      { key: 'campaigns', href: '/campaigns' },
    ],
  },
  {
    key: 'settingsGroup',
    children: [
      { key: 'settings', href: '/settings' },
      { key: 'users', href: '/users' },
      { key: 'integrations', href: '/integrations' },
      { key: 'billing', href: '/billing' },
    ],
  },
];

const ICONS: Record<string, string> = {
  dashboard: 'M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z',
  menu: 'M5 4h14v16H5zM9 8h6M9 12h6M9 16h3',
  ingredients: 'M9 3h6l-1 4h-4zM7 7h10l-1.2 12.2a2 2 0 0 1-2 1.8H10.2a2 2 0 0 1-2-1.8z',
  orders: 'M6 3l1.5 1.5L9 3l1.5 1.5L12 3l1.5 1.5L15 3l1.5 1.5L18 3v18l-1.5-1.5L15 21l-1.5-1.5L12 21l-1.5-1.5L9 21l-1.5-1.5L6 21zM9 9h6M9 13h6',
  pos: 'M3 7h18v10H3zM3 11h18M7 15h3',
  tables: 'M4 4h7v7H4zM14 4h6v6h-6zM4 14h6v6H4zM15 15h5M15 20h5M20 15v5',
  branches: 'M4 21V8l8-5 8 5v13M9 21v-6h6v6M4 21h16',
  customers: 'M16 20a4 4 0 0 0-8 0M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8M21 20a3.5 3.5 0 0 0-4-3.2M17 4.5a3 3 0 0 1 0 6',
  reviews: 'M12 3l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9 6.8 19.1l1-5.8L3.5 9.2l5.9-.9z',
  coupons: 'M3 8v4l9 9 9-9-9-9H6a3 3 0 0 0-3 3zM8 8h.01',
  campaigns: 'M3 11v2l13 5V6zM16 9a3 3 0 0 1 0 6M6 13v5h3',
  marketing: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM12 13a1 1 0 1 0 0-2 1 1 0 0 0 0 2z',
  integrations: 'M9 2v4M15 2v4M7 6h10v4a5 5 0 0 1-10 0zM12 15v5',
  users: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8M22 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8',
  billing: 'M3 7h18v10H3zM3 11h18M7 15h4',
  settings: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 13a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-2.7 1.1V21a2 2 0 1 1-4 0v-.2A1.6 1.6 0 0 0 7 19.4a1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1A1.6 1.6 0 0 0 2.6 14H2.4a2 2 0 1 1 0-4h.2A1.6 1.6 0 0 0 4 7a1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1A1.6 1.6 0 0 0 9 2.6h.1A1.6 1.6 0 0 0 10 1.1V1a2 2 0 1 1 4 0v.2A1.6 1.6 0 0 0 17 2.6a1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8V7a1.6 1.6 0 0 0 1.5 1h.2a2 2 0 1 1 0 4h-.2a1.6 1.6 0 0 0-1.6 1z',
  hotel: 'M3 18v-6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v6M3 14h18M6 10V8a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2',
  settingsGroup: 'M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6',
};

function NavIcon({ k }: { k: string }) {
  return (
    <svg viewBox="0 0 24 24" className="h-[18px] w-[18px] shrink-0" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round">
      <path d={ICONS[k] ?? ICONS.dashboard} />
    </svg>
  );
}

/** Collapsible sidebar group (e.g. Pazarlama → Kuponlar, Kampanyalar). */
function NavGroup({ node, pathname, onNavigate }: { node: { key: string; children: NavLeaf[] }; pathname: string; onNavigate: () => void }) {
  const nav = useTranslations('nav');
  const hasActive = node.children.some((c) => c.href === pathname);
  const [expanded, setExpanded] = useState(hasActive);
  useEffect(() => {
    if (hasActive) setExpanded(true);
  }, [hasActive]);

  return (
    <div>
      <button
        type="button"
        onClick={() => setExpanded((o) => !o)}
        className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition ${hasActive ? 'text-white' : 'text-slate-300 hover:bg-white/5 hover:text-white'}`}
      >
        <NavIcon k={node.key} />
        {nav(node.key as never)}
        <svg viewBox="0 0 24 24" className={`ml-auto h-3.5 w-3.5 transition-transform ${expanded ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round"><path d="m9 6 6 6-6 6" /></svg>
      </button>
      {expanded && (
        <div className="mt-1 space-y-1 border-l border-white/10 pl-3">
          {node.children.map((c) => {
            const active = pathname === c.href;
            return (
              <Link
                key={c.key}
                href={c.href}
                onClick={onNavigate}
                className={`flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-semibold transition ${active ? 'text-white shadow-lg' : 'text-slate-300 hover:bg-white/5 hover:text-white'}`}
                style={active ? { background: 'linear-gradient(135deg,#14b8a6,#0ea5e9)' } : undefined}
              >
                <NavIcon k={c.key} />
                {nav(c.key as never)}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

const LANGS: [string, string][] = [['tr', 'Türkçe'], ['en', 'English']];

/** Panel language switcher (cookie-based; reloads in the chosen language). */
function LangSwitcher() {
  const active = useLocale();
  const [open, setOpen] = useState(false);
  const cur = LANGS.find(([c]) => c === active) ?? LANGS[0];
  const pick = (code: string) => {
    document.cookie = `locale=${code}; path=/; max-age=31536000; samesite=lax`;
    window.location.reload();
  };
  return (
    <div className="relative" data-tour="lang">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex items-center gap-1.5 rounded-full border border-line bg-surface px-3 py-1.5 text-sm font-semibold text-ink transition hover:bg-canvas"
      >
        <svg viewBox="0 0 24 24" className="h-4 w-4 text-muted" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3c2.5 2.6 2.5 15 0 18M12 3c-2.5 2.6-2.5 15 0 18" /></svg>
        <span className="hidden sm:inline">{cur[1]}</span>
        <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 text-muted" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><path d="m6 9 6 6 6-6" /></svg>
      </button>
      {open && (
        <div className="absolute right-0 z-40 mt-1 w-32 overflow-hidden rounded-xl border border-line bg-surface py-1 shadow-xl">
          {LANGS.map(([code, label]) => (
            <button
              key={code}
              type="button"
              onClick={() => pick(code)}
              className={`block w-full px-3 py-2 text-left text-sm ${code === active ? 'bg-brand-50 font-semibold text-brand-700' : 'text-ink hover:bg-canvas'}`}
            >
              {label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function AdminShell({ title, children }: { title?: string; children: React.ReactNode }) {
  const nav = useTranslations('nav');
  const pathname = usePathname();
  const router = useRouter();
  const [branches, setBranches] = useState<any[]>([]);
  const [activeBranch, setActive] = useState<number | null>(null);
  const [impersonating, setImpersonating] = useState(false);
  const [currentName, setCurrentName] = useState<string>('');
  const [vertical, setVertical] = useState<string>('restaurant');
  const [open, setOpen] = useState(false);

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

  const navItems: NavNode[] = [...NAV];
  if (['hotel', 'beach'].includes(vertical)) {
    const at = navItems.findIndex((i) => i.key === 'settingsGroup');
    navItems.splice(at < 0 ? navItems.length : at, 0, { key: 'hotel', href: '/hotel' });
  }

  function logout() {
    createApi(getToken()).logout().catch(() => undefined);
    clearSession();
    router.replace('/login');
  }

  const sidebar = (
    <div className="flex h-full flex-col rounded-3xl p-4 text-white shadow-2xl" style={{ background: 'linear-gradient(180deg,#153453 0%,#0e2740 55%,#0a1f34 100%)' }}>
      <div className="flex items-center gap-2.5 px-2 py-2">
        <span className="grid h-9 w-9 place-items-center rounded-xl font-extrabold text-white shadow-lg" style={{ background: 'linear-gradient(135deg,#2dd4bf,#0ea5e9)' }}>Q</span>
        <span className="text-lg font-extrabold tracking-tight">ComiQR</span>
      </div>

      {branches.length > 1 && (
        <select
          value={activeBranch ?? ''}
          onChange={(e) => switchBranch(Number(e.target.value))}
          className="mt-4 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none"
        >
          {branches.map((b) => (<option key={b.id} value={b.id} className="text-ink">{b.name}</option>))}
        </select>
      )}

      <nav className="no-scrollbar mt-5 flex-1 space-y-1 overflow-y-auto">
        {navItems.map((it) => {
          if ('children' in it) {
            return <NavGroup key={it.key} node={it} pathname={pathname} onNavigate={() => setOpen(false)} />;
          }
          const active = pathname === it.href;
          return (
            <Link
              key={it.key}
              href={it.href}
              onClick={() => setOpen(false)}
              className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition ${
                active ? 'text-white shadow-lg' : 'text-slate-300 hover:bg-white/5 hover:text-white'
              }`}
              style={active ? { background: 'linear-gradient(135deg,#14b8a6,#0ea5e9)' } : undefined}
            >
              <NavIcon k={it.key} />
              {nav(it.key as never)}
            </Link>
          );
        })}
      </nav>

      <TrialCard />

      <div className="mt-4 rounded-2xl bg-white/5 p-3.5">
        <div className="flex items-center gap-2 text-xs font-bold text-white">
          <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_0_3px_rgba(52,211,153,.25)]" />
          Sistem Durumu
        </div>
        <div className="mt-0.5 text-[11px] text-slate-400">Tüm sistemler çalışıyor</div>
      </div>

      <button onClick={logout} className="mt-3 flex items-center justify-center gap-2 rounded-xl border border-white/10 py-2.5 text-sm font-semibold text-slate-300 transition hover:bg-white/5 hover:text-white">
        <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" /></svg>
        {nav('logout')}
      </button>
    </div>
  );

  return (
    <div className="grid min-h-screen bg-canvas lg:grid-cols-[17rem_1fr]">
      {/* Desktop sidebar */}
      <aside className="hidden p-3 lg:block">
        <div className="sticky top-3 h-[calc(100vh-1.5rem)]">{sidebar}</div>
      </aside>

      {/* Mobile drawer */}
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <div className="absolute inset-y-0 left-0 w-72 max-w-[85%] p-3">{sidebar}</div>
        </div>
      )}

      {/* Main column */}
      <div className="flex min-h-screen min-w-0 flex-col">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-4 border-b border-line bg-surface/90 px-5 backdrop-blur lg:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <button onClick={() => setOpen(true)} aria-label="Menü" className="grid h-9 w-9 place-items-center rounded-lg border border-line text-ink lg:hidden">
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><path d="M4 7h16M4 12h16M4 17h16" /></svg>
            </button>
            {title && <h1 className="truncate text-lg font-bold text-ink">{title}</h1>}
          </div>
          <div className="flex items-center gap-2.5">
            <SetupGuide />
            <LangSwitcher />
            <button aria-label="Ara" className="grid h-9 w-9 place-items-center rounded-full text-muted transition hover:bg-canvas hover:text-ink">
              <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><circle cx="11" cy="11" r="7" /><path d="m20 20-3-3" /></svg>
            </button>
            <button aria-label="Bildirimler" className="relative grid h-9 w-9 place-items-center rounded-full text-muted transition hover:bg-canvas hover:text-ink">
              <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 0 1-3.4 0" /></svg>
              <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-brand-500 ring-2 ring-surface" />
            </button>
            <div className="flex items-center gap-2 rounded-full border border-line bg-surface py-1 pl-1 pr-3">
              <span className="grid h-7 w-7 place-items-center rounded-full text-xs font-bold text-white" style={{ background: 'linear-gradient(135deg,#14b8a6,#0ea5e9)' }}>
                {(currentName || 'C').charAt(0).toUpperCase()}
              </span>
              <span className="hidden max-w-[8rem] truncate text-sm font-semibold text-ink sm:block">{currentName || 'Hesabım'}</span>
            </div>
          </div>
        </header>

        <main className="flex-1 p-5 lg:p-8">
          {impersonating && (
            <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
              <span className="text-sm text-amber-900">🔓 <b>{currentName || 'Bir işletme'}</b> paneline süper admin olarak giriş yaptınız.</span>
              <button onClick={returnToSuper} className="rounded-lg bg-ink px-3 py-1.5 text-xs font-semibold text-white transition hover:opacity-90">← Süper admin&apos;e dön</button>
            </div>
          )}
          {children}
        </main>
      </div>
    </div>
  );
}
