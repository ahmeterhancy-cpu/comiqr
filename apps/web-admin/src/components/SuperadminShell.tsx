'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Brand } from '@/components/ui';
import { APP_NAME, createApi } from '@/lib/api';

type IconName =
  | 'dashboard'
  | 'store'
  | 'allergy'
  | 'membership'
  | 'transactions'
  | 'users'
  | 'language'
  | 'currency'
  | 'clock'
  | 'audit'
  | 'design'
  | 'settings';

const PATHS: Record<IconName, string> = {
  dashboard: 'M3 12l9-9 9 9M5 10v10h5v-6h4v6h5V10',
  store: 'M3 9l1.5-5h15L21 9M4 9v11h16V9M4 9h16M9 20v-5h6v5',
  allergy: 'M12 3a9 9 0 100 18 9 9 0 000-18zM12 8v5M12 16h.01',
  membership: 'M4 7h16v12H4zM4 7l4-3h8l4 3M9 12h6',
  transactions: 'M4 17l5-5 4 4 7-8M14 8h6v6',
  users: 'M16 19v-1a4 4 0 00-4-4H7a4 4 0 00-4 4v1M8.5 10a3 3 0 100-6 3 3 0 000 6zM17 19v-1a4 4 0 00-3-3.87M15 4.13a4 4 0 010 7.75',
  language: 'M3 12a9 9 0 1018 0 9 9 0 00-18 0zM3 12h18M12 3c2.5 2.5 2.5 15 0 18M12 3c-2.5 2.5-2.5 15 0 18',
  currency: 'M12 3v18M8 7h5a3 3 0 010 6H8h8',
  clock: 'M12 21a9 9 0 100-18 9 9 0 000 18zM12 7v5l3 2',
  audit: 'M9 12l2 2 4-4M12 3l7 3v5c0 5-3.5 8-7 9-3.5-1-7-4-7-9V6l7-3z',
  design: 'M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z',
  settings: 'M12 15a3 3 0 100-6 3 3 0 000 6zM19 12a7 7 0 00-.1-1l2-1.6-2-3.4-2.4 1a7 7 0 00-1.7-1L14.5 2h-4l-.3 2.6a7 7 0 00-1.7 1l-2.4-1-2 3.4 2 1.6a7 7 0 000 2l-2 1.6 2 3.4 2.4-1a7 7 0 001.7 1l.3 2.6h4l.3-2.6a7 7 0 001.7-1l2.4 1 2-3.4-2-1.6a7 7 0 00.1-1z',
};

function Icon({ name }: { name: IconName }) {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d={PATHS[name]} />
    </svg>
  );
}

const NAV: { group: string; items: { label: string; href: string; icon: IconName; badge?: string }[] }[] = [
  { group: 'APPS', items: [{ label: 'Panel', href: '/superadmin', icon: 'dashboard' }] },
  {
    group: 'YÖNETİM',
    items: [
      { label: 'İşletmeler', href: '/superadmin/restaurants', icon: 'store' },
      { label: 'QR Menü Tasarımları', href: '/superadmin/menu-designs', icon: 'design', badge: 'Yeni' },
      { label: 'Landing Sayfası', href: '/superadmin/landing', icon: 'design', badge: 'Yeni' },
      { label: 'Alerjenler', href: '/superadmin/allergens', icon: 'allergy', badge: 'Yeni' },
      { label: 'Üyelik / Planlar', href: '/superadmin/membership', icon: 'membership' },
      { label: 'İşlemler', href: '/superadmin/transactions', icon: 'transactions' },
      { label: 'Kullanıcılar', href: '/superadmin/users', icon: 'users' },
    ],
  },
  {
    group: 'ULUSLARARASI',
    items: [
      { label: 'Diller', href: '/superadmin/languages', icon: 'language' },
      { label: 'Para Birimleri', href: '/superadmin/currencies', icon: 'currency' },
      { label: 'Saat Dilimleri', href: '/superadmin/timezones', icon: 'clock' },
    ],
  },
  {
    group: 'SİSTEM',
    items: [
      { label: 'Denetim Kaydı', href: '/superadmin/audit', icon: 'audit' },
      { label: 'Ayarlar', href: '/superadmin/settings', icon: 'settings' },
    ],
  },
];

export function SuperadminShell({ userName, children }: { userName?: string; children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  function logout() {
    createApi().logout().catch(() => undefined);
    localStorage.clear();
    router.replace('/login');
  }

  return (
    <div className="min-h-screen bg-canvas">
      {/* Top bar */}
      <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-line bg-surface px-4 sm:px-6">
        <div className="flex items-center gap-4">
          <Brand name={APP_NAME} />
          <span className="hidden text-sm font-semibold text-ink sm:inline">Admin Panel</span>
          <span className="rounded-full bg-ink px-2.5 py-0.5 text-xs font-semibold text-white">Superadmin</span>
        </div>
        <div className="flex items-center gap-3">
          {userName && <span className="hidden text-sm font-medium text-ink sm:inline">{userName}</span>}
          <button onClick={logout} className="rounded-lg border border-line px-3 py-1.5 text-sm font-medium text-muted hover:text-ink">
            Çıkış
          </button>
        </div>
      </header>

      <div className="mx-auto flex max-w-7xl">
        {/* Sidebar */}
        <aside className="hidden w-60 shrink-0 border-r border-line px-3 py-6 md:block">
          <nav className="space-y-6">
            {NAV.map((section) => (
              <div key={section.group}>
                <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-[0.15em] text-muted">{section.group}</p>
                <div className="space-y-0.5">
                  {section.items.map((it) => {
                    const active = pathname === it.href;
                    return (
                      <Link
                        key={it.href}
                        href={it.href}
                        className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition ${
                          active ? 'bg-brand-50 text-brand-700' : 'text-muted hover:bg-canvas hover:text-ink'
                        }`}
                      >
                        <span className={active ? 'text-brand-600' : 'text-muted'}>
                          <Icon name={it.icon} />
                        </span>
                        <span className="flex-1">{it.label}</span>
                        {it.badge && (
                          <span className="rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700">
                            {it.badge}
                          </span>
                        )}
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
          </nav>
        </aside>

        {/* Content */}
        <main className="min-w-0 flex-1 p-4 sm:p-6">{children}</main>
      </div>
    </div>
  );
}
