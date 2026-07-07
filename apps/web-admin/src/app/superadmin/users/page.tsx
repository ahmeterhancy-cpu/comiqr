'use client';

import { useCallback, useEffect, useState } from 'react';
import { Panel } from '@/components/superadmin-ui';
import { Button, Field, Input } from '@/components/ui';
import { useApi } from '@/lib/useApi';

const ROLES: { value: string; label: string }[] = [
  { value: 'owner', label: 'Owner — İşletme sahibi' },
  { value: 'manager', label: 'Manager — Yönetici' },
  { value: 'waiter', label: 'Waiter — Garson' },
  { value: 'kitchen', label: 'Kitchen — Mutfak' },
  { value: 'superadmin', label: 'Superadmin — Platform yöneticisi' },
];

const ROLE_BADGE: Record<string, string> = {
  superadmin: 'bg-brand-500/10 text-brand-600',
  owner: 'bg-emerald-100 text-emerald-800',
  manager: 'bg-amber-100 text-amber-800',
  waiter: 'bg-sky-100 text-sky-800',
  kitchen: 'bg-slate-200 text-slate-700',
};

const selectCls =
  'w-full rounded-lg border border-line bg-white px-3.5 py-2.5 text-sm text-ink outline-none transition focus:border-brand-500 focus:ring-4 focus:ring-brand-100';

type Row = {
  id: number;
  name: string;
  email: string;
  role: string;
  role_label: string;
  tenant: string | null;
  tenant_slug: string | null;
  last_login_at: string | null;
  created_at: string | null;
};

type TenantOption = { id: number; name: string; slug: string };

export default function UsersPage() {
  const { api, ready } = useApi();

  const [q, setQ] = useState('');
  const [debouncedQ, setDebouncedQ] = useState('');
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<Row[]>([]);
  const [meta, setMeta] = useState({ total: 0, page: 1, per_page: 25, last_page: 1 });
  const [loading, setLoading] = useState(true);

  // --- create form ---
  const [showForm, setShowForm] = useState(false);
  const [tenants, setTenants] = useState<TenantOption[]>([]);
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'owner', tenant_id: '' });
  const [saving, setSaving] = useState(false);
  const [formErr, setFormErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const load = useCallback(
    async (query: string, pg: number) => {
      setLoading(true);
      try {
        const r = await api.superUsers({ q: query.length >= 2 ? query : undefined, page: pg });
        setRows(r.users);
        setMeta({ total: r.total, page: r.page, per_page: r.per_page, last_page: r.last_page });
      } catch {
        setRows([]);
      } finally {
        setLoading(false);
      }
    },
    [api],
  );

  // Debounce the query and snap back to page 1 whenever it changes.
  useEffect(() => {
    const id = setTimeout(() => {
      setDebouncedQ(q.trim());
      setPage(1);
    }, 250);
    return () => clearTimeout(id);
  }, [q]);

  useEffect(() => {
    if (!ready) return;
    load(debouncedQ, page);
  }, [ready, debouncedQ, page, load]);

  // Tenant options for the create form (owner/manager/… must belong to one).
  useEffect(() => {
    if (!ready) return;
    api
      .superTenants()
      .then((list: any[]) => setTenants(list.map((t) => ({ id: t.id, name: t.name, slug: t.slug }))))
      .catch(() => setTenants([]));
  }, [ready, api]);

  const needsTenant = form.role !== 'superadmin';

  async function submit() {
    setFormErr(null);
    setOk(null);
    setSaving(true);
    try {
      const created = await api.superCreateUser({
        name: form.name.trim(),
        email: form.email.trim(),
        password: form.password,
        role: form.role,
        tenant_id: needsTenant ? (form.tenant_id ? Number(form.tenant_id) : null) : null,
      });
      setOk(`${created.email} (${created.role_label}) oluşturuldu.`);
      setForm({ name: '', email: '', password: '', role: 'owner', tenant_id: '' });
      setShowForm(false);
      setQ('');
      setDebouncedQ('');
      setPage(1);
      load('', 1);
    } catch (e: any) {
      const errs = e?.errors ?? {};
      const first = Object.values(errs)[0] as string[] | undefined;
      setFormErr((Array.isArray(first) ? first[0] : undefined) ?? e?.message ?? 'Kullanıcı oluşturulamadı.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Panel
      title="Kullanıcılar"
      right={
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted">{meta.total} kullanıcı</span>
          <Button onClick={() => { setShowForm((s) => !s); setFormErr(null); }} className="px-3 py-1.5 text-sm">
            {showForm ? 'Kapat' : '+ Yeni Kullanıcı'}
          </Button>
        </div>
      }
    >
      {showForm && (
        <div className="mb-5 rounded-2xl border border-line bg-canvas/60 p-5">
          <h3 className="mb-3 text-sm font-bold text-ink">Yeni kullanıcı oluştur</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Ad Soyad">
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ahmet Yılmaz" />
            </Field>
            <Field label="E-posta">
              <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="ahmet@isletme.com" />
            </Field>
            <Field label="Şifre" hint="En az 8 karakter">
              <Input type="text" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="••••••••" />
            </Field>
            <Field label="Rol">
              <select className={selectCls} value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
                {ROLES.map((r) => (
                  <option key={r.value} value={r.value}>{r.label}</option>
                ))}
              </select>
            </Field>
            {needsTenant && (
              <Field label="İşletme" hint="Bu rol bir işletmeye bağlı olmalı">
                <select className={selectCls} value={form.tenant_id} onChange={(e) => setForm({ ...form, tenant_id: e.target.value })}>
                  <option value="">— İşletme seç —</option>
                  {tenants.map((t) => (
                    <option key={t.id} value={t.id}>{t.name} ({t.slug})</option>
                  ))}
                </select>
              </Field>
            )}
          </div>
          {formErr && <p className="mt-3 text-sm text-red-600">{formErr}</p>}
          <div className="mt-4 flex items-center gap-2">
            <Button onClick={submit} loading={saving} disabled={!form.name || !form.email || form.password.length < 8}>
              Oluştur
            </Button>
            <Button variant="ghost" onClick={() => { setShowForm(false); setFormErr(null); }}>Vazgeç</Button>
          </div>
        </div>
      )}

      {ok && <p className="mb-3 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{ok}</p>}

      <Input placeholder="E-posta veya isimle ara…" value={q} onChange={(e) => setQ(e.target.value)} />

      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
              <th className="py-2">Kullanıcı</th>
              <th>Rol</th>
              <th>İşletme</th>
              <th className="text-right">Son giriş</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((u) => (
              <tr key={u.id} className="border-b border-line/60">
                <td className="py-2.5">
                  <div className="font-medium text-ink">{u.name}</div>
                  <div className="text-xs text-muted">{u.email}</div>
                </td>
                <td>
                  <span className={`rounded-md px-2 py-0.5 text-xs font-medium ${ROLE_BADGE[u.role] ?? 'bg-canvas text-muted'}`}>
                    {u.role_label}
                  </span>
                </td>
                <td className="text-muted">
                  {u.tenant ?? <span className="text-brand-600">— Platform</span>}
                </td>
                <td className="text-right text-xs text-muted">
                  {u.last_login_at ? new Date(u.last_login_at).toLocaleDateString('tr-TR') : '—'}
                </td>
              </tr>
            ))}
            {!loading && rows.length === 0 && (
              <tr><td colSpan={4} className="py-6 text-center text-muted">Kullanıcı bulunamadı.</td></tr>
            )}
            {loading && (
              <tr><td colSpan={4} className="py-6 text-center text-muted">Yükleniyor…</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {meta.last_page > 1 && (
        <div className="mt-4 flex items-center justify-between text-sm">
          <span className="text-muted">Sayfa {meta.page} / {meta.last_page}</span>
          <div className="flex gap-2">
            <Button variant="ghost" className="px-3 py-1.5" disabled={meta.page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
              ← Önceki
            </Button>
            <Button variant="ghost" className="px-3 py-1.5" disabled={meta.page >= meta.last_page} onClick={() => setPage((p) => p + 1)}>
              Sonraki →
            </Button>
          </div>
        </div>
      )}
    </Panel>
  );
}
