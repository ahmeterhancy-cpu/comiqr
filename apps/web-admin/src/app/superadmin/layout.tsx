'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { SuperadminShell } from '@/components/SuperadminShell';
import { useApi } from '@/lib/useApi';

export default function SuperadminLayout({ children }: { children: React.ReactNode }) {
  const { me, ready } = useApi();
  const router = useRouter();

  useEffect(() => {
    if (ready && me && me.user.role !== 'superadmin') router.replace('/dashboard');
  }, [ready, me, router]);

  if (!ready || !me || me.user.role !== 'superadmin') {
    return <div className="grid min-h-screen place-items-center text-sm text-muted">…</div>;
  }

  return <SuperadminShell userName={me.user.name}>{children}</SuperadminShell>;
}
