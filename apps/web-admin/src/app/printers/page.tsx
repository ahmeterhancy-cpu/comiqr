'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { AdminShell } from '@/components/AdminShell';
import { Gated, Select } from '@/components/finance-kit';
import { Button, Card, Field, Input } from '@/components/ui';
import { useApi } from '@/lib/useApi';

export default function PrintersPage() {
  const t = useTranslations('printers');
  const c = useTranslations('common');
  const { api, ready } = useApi();

  const [printers, setPrinters] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [jobs, setJobs] = useState<any[]>([]);
  const [pending, setPending] = useState(0);
  const [gated, setGated] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [list, cats, queue] = await Promise.all([
        api.adminPrinters(),
        api.adminCategories(),
        api.printJobs({ per_page: 20 }),
      ]);
      setPrinters(list ?? []);
      setCategories(cats ?? []);
      setJobs(queue?.data?.data ?? []);
      setPending(queue?.meta?.pending ?? 0);
      setGated(false);
    } catch {
      setGated(true);
    }
  }, [api]);

  useEffect(() => {
    if (ready) load();
  }, [ready, load]);

  return (
    <AdminShell title={t('title')}>
      {gated ? (
        <Gated message={t('gated')} />
      ) : (
        <>
          <div className="mb-5 rounded-2xl border border-sky-200 bg-sky-50 p-4 text-sm text-sky-900">
            {t('bridgeNote')}
          </div>

          <div className="mb-5 flex flex-wrap items-center gap-3">
            <Button onClick={() => setShowForm((v) => !v)}>{showForm ? c('close') : t('addPrinter')}</Button>
            <span className="text-sm text-muted">{t('pendingJobs', { count: pending })}</span>
            {notice && <span className="text-sm font-medium text-emerald-700">{notice}</span>}
          </div>

          {showForm && (
            <PrinterForm
              api={api}
              categories={categories}
              onDone={() => {
                setShowForm(false);
                load();
              }}
            />
          )}

          <Card className="mt-5">
            {printers.length === 0 ? (
              <p className="text-sm text-muted">{t('noPrinters')}</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
                      <th className="py-2">{c('name')}</th>
                      <th>{t('kind')}</th>
                      <th>{t('routes')}</th>
                      <th>{t('target')}</th>
                      <th className="text-right">{t('queue')}</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {printers.map((p) => (
                      <tr key={p.id} className="border-b border-line/60">
                        <td className="py-2.5 font-medium text-ink">
                          {p.name}
                          {!p.is_active && <span className="ml-2 text-xs text-muted">· {c('inactive')}</span>}
                        </td>
                        <td className="text-muted">{t(`kind_${p.kind}` as never)}</td>
                        <td className="text-xs text-muted">
                          {(p.category_ids_json ?? []).length === 0
                            ? t('allCategories')
                            : categories
                                .filter((cat) => (p.category_ids_json ?? []).map(Number).includes(cat.id))
                                .map((cat) => cat.name)
                                .join(', ')}
                        </td>
                        <td className="text-xs text-muted">{p.target ?? '—'}</td>
                        <td className="text-right tabular-nums text-muted">{p.pending_jobs_count ?? 0}</td>
                        <td className="text-right">
                          <button
                            type="button"
                            className="mr-3 text-xs font-semibold text-brand-600 hover:underline"
                            onClick={async () => {
                              await api.testPrinter(p.id);
                              setNotice(t('testQueued', { name: p.name }));
                              load();
                            }}
                          >
                            {t('testPrint')}
                          </button>
                          <button
                            type="button"
                            className="text-xs font-semibold text-red-600 hover:underline"
                            onClick={async () => {
                              if (!confirm(t('confirmDelete'))) return;
                              await api.deletePrinter(p.id);
                              load();
                            }}
                          >
                            {c('delete')}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          <Card className="mt-5">
            <h2 className="mb-3 text-sm font-semibold text-ink">{t('queueTitle')}</h2>
            {jobs.length === 0 ? (
              <p className="text-sm text-muted">{t('noJobs')}</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
                      <th className="py-2">#</th>
                      <th>{t('printer')}</th>
                      <th>{t('jobType')}</th>
                      <th>{t('content')}</th>
                      <th>{c('status')}</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {jobs.map((j) => (
                      <tr key={j.id} className="border-b border-line/60">
                        <td className="py-2 text-muted">{j.id}</td>
                        <td className="text-ink">{j.printer?.name ?? '—'}</td>
                        <td className="text-muted">{t(`type_${j.type}` as never)}</td>
                        <td className="text-xs text-muted">
                          {(j.payload_json?.lines ?? [])
                            .map((l: any) => `${l.quantity}× ${l.name}`)
                            .join(', ') || '—'}
                        </td>
                        <td>
                          <StatusTag status={j.status} label={t(`status_${j.status}` as never)} error={j.error} />
                        </td>
                        <td className="text-right">
                          {j.status === 'failed' && (
                            <button
                              type="button"
                              className="text-xs font-semibold text-brand-600 hover:underline"
                              onClick={async () => {
                                await api.retryPrintJob(j.id);
                                load();
                              }}
                            >
                              {t('retry')}
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </>
      )}
    </AdminShell>
  );
}

function StatusTag({ status, label, error }: { status: string; label: string; error?: string | null }) {
  const tone =
    status === 'printed'
      ? 'bg-emerald-50 text-emerald-700'
      : status === 'failed'
        ? 'bg-red-50 text-red-700'
        : 'bg-amber-50 text-amber-800';

  return (
    <span className={`inline-block rounded-full px-2.5 py-1 text-xs font-semibold ${tone}`} title={error ?? undefined}>
      {label}
    </span>
  );
}

function PrinterForm({ api, categories, onDone }: { api: any; categories: any[]; onDone: () => void }) {
  const t = useTranslations('printers');
  const c = useTranslations('common');
  const [f, setF] = useState<Record<string, string>>({ kind: 'kitchen', copies: '1' });
  const [picked, setPicked] = useState<number[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const set = (k: string, v: string) => setF((s) => ({ ...s, [k]: v }));

  return (
    <Card>
      <form
        className="grid gap-4 sm:grid-cols-3"
        onSubmit={async (e) => {
          e.preventDefault();
          setSaving(true);
          setError(null);
          try {
            await api.createPrinter({
              name: f.name,
              kind: f.kind,
              target: f.target || null,
              copies: Number(f.copies || 1),
              category_ids_json: picked,
            });
            onDone();
          } catch (err: any) {
            setError(err?.message ?? c('error'));
          } finally {
            setSaving(false);
          }
        }}
      >
        <Field label={c('name')}>
          <Input required value={f.name ?? ''} onChange={(e) => set('name', e.target.value)} placeholder={t('namePlaceholder')} />
        </Field>
        <Field label={t('kind')}>
          <Select value={f.kind} onChange={(v) => set('kind', v)}>
            <option value="kitchen">{t('kind_kitchen')}</option>
            <option value="bar">{t('kind_bar')}</option>
            <option value="cashier">{t('kind_cashier')}</option>
            <option value="label">{t('kind_label')}</option>
          </Select>
        </Field>
        <Field label={t('target')} hint={t('targetHint')}>
          <Input value={f.target ?? ''} onChange={(e) => set('target', e.target.value)} placeholder="192.168.1.50:9100" />
        </Field>

        <div className="sm:col-span-3">
          <span className="mb-1.5 block text-sm font-medium text-ink">{t('routes')}</span>
          <p className="mb-2 text-xs text-muted">{t('routesHint')}</p>
          <div className="flex flex-wrap gap-2">
            {categories.map((cat) => {
              const on = picked.includes(cat.id);

              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setPicked((s) => (on ? s.filter((id) => id !== cat.id) : [...s, cat.id]))}
                  className={`rounded-full border px-3 py-1.5 text-sm font-medium transition ${
                    on ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-line bg-white text-muted hover:text-ink'
                  }`}
                >
                  {cat.name}
                </button>
              );
            })}
          </div>
        </div>

        <Field label={t('copies')}>
          <Input type="number" min="1" max="5" value={f.copies} onChange={(e) => set('copies', e.target.value)} />
        </Field>

        {error && <p className="text-sm text-red-600 sm:col-span-3">{error}</p>}

        <div className="sm:col-span-3">
          <Button type="submit" loading={saving}>
            {c('save')}
          </Button>
        </div>
      </form>
    </Card>
  );
}
