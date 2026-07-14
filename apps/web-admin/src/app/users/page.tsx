'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import type { StaffRole, StaffUser } from '@comiqr/shared-types';
import { ApiError } from '@comiqr/shared-types/client';
import { AdminShell } from '@/components/AdminShell';
import { Button, Card, Field, Input } from '@/components/ui';
import { useApi } from '@/lib/useApi';

const ROLES: { value: StaffRole; labelKey: string; descKey: string }[] = [
  { value: 'manager', labelKey: 'roleManager', descKey: 'roleDescManager' },
  { value: 'waiter', labelKey: 'roleWaiter', descKey: 'roleDescWaiter' },
  { value: 'kitchen', labelKey: 'roleKitchen', descKey: 'roleDescKitchen' },
  { value: 'cashier', labelKey: 'roleCashier', descKey: 'roleDescCashier' },
];

const ROLE_CLS: Record<string, string> = {
  owner: 'bg-brand-100 text-brand-700',
  manager: 'bg-sky-100 text-sky-700',
  waiter: 'bg-amber-100 text-amber-700',
  kitchen: 'bg-violet-100 text-violet-700',
  cashier: 'bg-emerald-100 text-emerald-700',
};

const ROLE_LABEL: Record<string, string> = { owner: 'roleLabelOwner', manager: 'roleLabelManager', waiter: 'roleLabelWaiter', kitchen: 'roleLabelKitchen', cashier: 'roleLabelCashier' };

export default function UsersPage() {
  const t = useTranslations('users');
  const c = useTranslations('common');
  const { api, me, ready } = useApi();
  const [users, setUsers] = useState<StaffUser[]>([]);
  const [loading, setLoading] = useState(true);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<StaffRole>('waiter');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const meId = me?.user.id;

  function load() {
    api
      .staff()
      .then(setUsers)
      .catch(() => setError(t('loadError')))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    if (ready) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  async function addStaff(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setDone(null);
    try {
      await api.createStaff({ name: name.trim(), email: email.trim(), phone: phone.trim() || undefined, password, role });
      setDone(t('staffAdded', { name: name.trim() }));
      setName('');
      setEmail('');
      setPhone('');
      setPassword('');
      setRole('waiter');
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.first('email') ?? err.message : t('addError'));
    } finally {
      setBusy(false);
    }
  }

  async function toggleActive(u: StaffUser) {
    await api.updateStaff(u.id, { is_active: !u.is_active }).catch(() => undefined);
    load();
  }

  async function changeRole(u: StaffUser, r: StaffRole) {
    await api.updateStaff(u.id, { role: r }).catch(() => undefined);
    load();
  }

  async function remove(u: StaffUser) {
    if (!confirm(t('confirmDelete', { name: u.name }))) return;
    await api.deleteStaff(u.id).catch(() => undefined);
    load();
  }

  return (
    <AdminShell title={t('title')}>
      <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        {/* List */}
        <Card>
          <h2 className="mb-4 text-sm font-semibold text-ink">{t('staffCount', { count: users.length })}</h2>
          {loading ? (
            <p className="py-8 text-center text-sm text-muted">{c('loading')}</p>
          ) : users.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted">{t('emptyStaff')}</p>
          ) : (
            <ul className="divide-y divide-line">
              {users.map((u) => (
                <li key={u.id} className="flex flex-wrap items-center gap-3 py-3">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-sm font-bold text-white" style={{ background: 'linear-gradient(135deg,#14b8a6,#0ea5e9)' }}>
                    {u.name.charAt(0).toUpperCase()}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate font-semibold text-ink">{u.name}</span>
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${ROLE_CLS[u.role] ?? 'bg-canvas text-muted'}`}>{ROLE_LABEL[u.role] ? t(ROLE_LABEL[u.role]) : u.role_label}</span>
                      {!u.is_active && <span className="rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-bold text-red-600">{t('blocked')}</span>}
                    </div>
                    <div className="truncate text-xs text-muted">{u.email}{u.phone ? ` · ${u.phone}` : ''}</div>
                  </div>

                  {u.is_owner || u.id === meId ? (
                    <span className="text-xs font-medium text-muted">{u.is_owner ? t('businessOwner') : t('you')}</span>
                  ) : (
                    <div className="flex items-center gap-2">
                      <select
                        value={u.role}
                        onChange={(e) => changeRole(u, e.target.value as StaffRole)}
                        className="rounded-lg border border-line bg-white px-2 py-1.5 text-xs font-medium text-ink outline-none"
                      >
                        {ROLES.map((r) => <option key={r.value} value={r.value}>{t(r.labelKey)}</option>)}
                      </select>
                      <button
                        type="button"
                        onClick={() => toggleActive(u)}
                        className={`rounded-lg px-2.5 py-1.5 text-xs font-semibold ${u.is_active ? 'bg-amber-100 text-amber-700 hover:bg-amber-200' : 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'}`}
                      >
                        {u.is_active ? t('block') : t('unblock')}
                      </button>
                      <button type="button" onClick={() => remove(u)} aria-label={c('delete')} className="grid h-8 w-8 place-items-center rounded-lg text-muted transition hover:bg-red-50 hover:text-red-600">
                        <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2m1 0v12a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1V7" /></svg>
                      </button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Card>

        {/* Add form */}
        <Card className="h-fit">
          <h2 className="mb-4 text-sm font-semibold text-ink">{t('addStaff')}</h2>
          <form className="space-y-3" onSubmit={addStaff}>
            <Field label={t('fullName')}><Input value={name} onChange={(e) => setName(e.target.value)} required /></Field>
            <Field label={t('email')}><Input value={email} onChange={(e) => setEmail(e.target.value)} type="email" required autoComplete="off" /></Field>
            <Field label={t('phoneShort')}><Input value={phone} onChange={(e) => setPhone(e.target.value)} type="tel" /></Field>
            <Field label={t('passwordLabel')} hint={t('passwordHint')}><Input value={password} onChange={(e) => setPassword(e.target.value)} type="password" required minLength={8} autoComplete="new-password" /></Field>
            <div>
              <span className="mb-1.5 block text-sm font-medium text-ink">{t('roleLabel')}</span>
              <div className="space-y-1.5">
                {ROLES.map((r) => (
                  <button
                    key={r.value}
                    type="button"
                    onClick={() => setRole(r.value)}
                    className={`block w-full rounded-xl border px-3 py-2 text-left transition ${role === r.value ? 'border-brand-500 bg-brand-50 ring-2 ring-brand-100' : 'border-line hover:border-brand-300'}`}
                  >
                    <span className="block text-sm font-semibold text-ink">{t(r.labelKey)}</span>
                    <span className="block text-[11px] text-muted">{t(r.descKey)}</span>
                  </button>
                ))}
              </div>
            </div>
            {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
            {done && <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{done}</p>}
            <Button type="submit" loading={busy} className="w-full">{busy ? t('adding') : t('addStaff')}</Button>
          </form>
        </Card>
      </div>
    </AdminShell>
  );
}
