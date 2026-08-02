'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { AdminShell } from '@/components/AdminShell';
import { Gated, money, RangeBar, Select, firstOfMonth, today } from '@/components/finance-kit';
import { Button, Card, Field, Input } from '@/components/ui';
import { useApi } from '@/lib/useApi';

export default function ExpensesPage() {
  const t = useTranslations('expenses');
  const c = useTranslations('common');
  const { api, me, ready } = useApi();
  const currency = me?.tenant?.currency ?? 'TRY';

  const [from, setFrom] = useState(firstOfMonth());
  const [to, setTo] = useState(today());
  const [rows, setRows] = useState<any[]>([]);
  const [meta, setMeta] = useState<any>(null);
  const [categories, setCategories] = useState<any[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [gated, setGated] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [showCategories, setShowCategories] = useState(false);

  const load = useCallback(async () => {
    try {
      const [list, cats, accs] = await Promise.all([
        api.adminExpenses({ from, to }),
        api.adminExpenseCategories(),
        api.adminAccounts({ type: 'supplier' }),
      ]);
      setRows(list?.data?.data ?? []);
      setMeta(list?.meta ?? null);
      setCategories(cats ?? []);
      setAccounts(accs ?? []);
      setGated(false);
    } catch {
      setGated(true);
    }
  }, [api, from, to]);

  useEffect(() => {
    if (ready) load();
  }, [ready, load]);

  return (
    <AdminShell title={t('title')}>
      {gated ? (
        <Gated message={t('gated')} />
      ) : (
        <>
          <RangeBar
            from={from}
            to={to}
            onFrom={setFrom}
            onTo={setTo}
            labels={{ from: c('from'), to: c('to') }}
            right={
              <>
                <Button variant="ghost" onClick={() => setShowCategories((v) => !v)}>
                  {t('manageCategories')}
                </Button>
                <Button onClick={() => setShowForm((v) => !v)}>{showForm ? c('close') : t('addExpense')}</Button>
              </>
            }
          />

          <div className="mb-5 grid gap-4 sm:grid-cols-3">
            <Card>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted">{t('periodTotal')}</p>
              <p className="mt-2 text-2xl font-bold tabular-nums text-ink">{money(meta?.total, currency)}</p>
            </Card>
            <Card>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted">{t('vatTotal')}</p>
              <p className="mt-2 text-2xl font-bold tabular-nums text-ink">{money(meta?.tax_total, currency)}</p>
            </Card>
            <Card>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted">{t('entryCount')}</p>
              <p className="mt-2 text-2xl font-bold tabular-nums text-ink">{meta?.count ?? 0}</p>
            </Card>
          </div>

          {showCategories && (
            <CategoryManager
              api={api}
              categories={categories}
              onChange={load}
              onClose={() => setShowCategories(false)}
            />
          )}

          {showForm && (
            <ExpenseForm
              api={api}
              categories={categories}
              accounts={accounts}
              onDone={() => {
                setShowForm(false);
                load();
              }}
            />
          )}

          <Card className="mt-5">
            {rows.length === 0 ? (
              <p className="text-sm text-muted">{t('noExpenses')}</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
                      <th className="py-2">{c('date')}</th>
                      <th>{c('description')}</th>
                      <th>{t('category')}</th>
                      <th>{t('paymentMethod')}</th>
                      <th className="text-right">{t('amount')}</th>
                      <th className="text-right">{t('vat')}</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((e) => (
                      <tr key={e.id} className="border-b border-line/60">
                        <td className="py-2.5 whitespace-nowrap text-muted">{String(e.spent_on).slice(0, 10)}</td>
                        <td className="font-medium text-ink">
                          {e.description}
                          {e.account && <span className="ml-2 text-xs text-muted">· {e.account.name}</span>}
                        </td>
                        <td>
                          {e.category ? (
                            <span
                              className="inline-block rounded-full px-2 py-0.5 text-xs font-semibold"
                              style={{
                                background: e.category.color ? `${e.category.color}1a` : '#f1f5f9',
                                color: e.category.color ?? '#475569',
                              }}
                            >
                              {e.category.name}
                            </span>
                          ) : (
                            <span className="text-xs text-muted">—</span>
                          )}
                        </td>
                        <td className="text-muted">{t(`method_${e.payment_method}` as never)}</td>
                        <td className="text-right tabular-nums text-ink">{money(e.amount, currency)}</td>
                        <td className="text-right tabular-nums text-muted">{money(e.tax_amount, currency)}</td>
                        <td className="text-right">
                          <button
                            type="button"
                            className="text-xs font-semibold text-red-600 hover:underline"
                            onClick={async () => {
                              if (!confirm(t('confirmDelete'))) return;
                              await api.deleteExpense(e.id);
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
        </>
      )}
    </AdminShell>
  );
}

function ExpenseForm({
  api,
  categories,
  accounts,
  onDone,
}: {
  api: any;
  categories: any[];
  accounts: any[];
  onDone: () => void;
}) {
  const t = useTranslations('expenses');
  const c = useTranslations('common');
  const [f, setF] = useState<Record<string, string>>({ payment_method: 'cash', spent_on: today() });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const set = (k: string, v: string) => setF((s) => ({ ...s, [k]: v }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await api.createExpense({
        description: f.description,
        amount: Number(f.amount || 0),
        tax_amount: Number(f.tax_amount || 0),
        payment_method: f.payment_method,
        spent_on: f.spent_on,
        expense_category_id: f.expense_category_id ? Number(f.expense_category_id) : null,
        account_id: f.account_id ? Number(f.account_id) : null,
        document_no: f.document_no || null,
        note: f.note || null,
      });
      onDone();
    } catch (err: any) {
      setError(err?.message ?? c('error'));
    } finally {
      setSaving(false);
    }
  }

  // Vadeli alımda gider bir tedarikçi borcuna dönüşür — cari zorunlu.
  const creditNeedsAccount = f.payment_method === 'credit';

  return (
    <Card className="mt-5">
      <form className="grid gap-4 sm:grid-cols-3" onSubmit={submit}>
        <div className="sm:col-span-2">
          <Field label={c('description')}>
            <Input required value={f.description ?? ''} onChange={(e) => set('description', e.target.value)} />
          </Field>
        </div>
        <Field label={c('date')}>
          <Input type="date" required value={f.spent_on} onChange={(e) => set('spent_on', e.target.value)} />
        </Field>

        <Field label={t('amountNet')}>
          <Input type="number" step="0.01" min="0" required value={f.amount ?? ''} onChange={(e) => set('amount', e.target.value)} />
        </Field>
        <Field label={t('vat')}>
          <Input type="number" step="0.01" min="0" value={f.tax_amount ?? ''} onChange={(e) => set('tax_amount', e.target.value)} />
        </Field>
        <Field label={t('paymentMethod')}>
          <Select value={f.payment_method} onChange={(v) => set('payment_method', v)}>
            <option value="cash">{t('method_cash')}</option>
            <option value="card">{t('method_card')}</option>
            <option value="transfer">{t('method_transfer')}</option>
            <option value="credit">{t('method_credit')}</option>
          </Select>
        </Field>

        <Field label={t('category')}>
          <Select value={f.expense_category_id ?? ''} onChange={(v) => set('expense_category_id', v)}>
            <option value="">{c('none')}</option>
            {categories.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={t('supplier')} hint={creditNeedsAccount ? t('creditHint') : undefined}>
          <Select value={f.account_id ?? ''} onChange={(v) => set('account_id', v)}>
            <option value="">{c('none')}</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={t('documentNo')}>
          <Input value={f.document_no ?? ''} onChange={(e) => set('document_no', e.target.value)} />
        </Field>

        {error && <p className="text-sm text-red-600 sm:col-span-3">{error}</p>}

        <div className="sm:col-span-3">
          <Button type="submit" loading={saving} disabled={creditNeedsAccount && !f.account_id}>
            {c('save')}
          </Button>
        </div>
      </form>
    </Card>
  );
}

function CategoryManager({
  api,
  categories,
  onChange,
  onClose,
}: {
  api: any;
  categories: any[];
  onChange: () => void;
  onClose: () => void;
}) {
  const t = useTranslations('expenses');
  const c = useTranslations('common');
  const [name, setName] = useState('');
  const [fixed, setFixed] = useState(false);

  return (
    <Card className="mt-5">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-ink">{t('categories')}</h2>
        <button type="button" className="text-xs font-semibold text-muted hover:text-ink" onClick={onClose}>
          {c('close')}
        </button>
      </div>

      <form
        className="mb-4 flex flex-wrap items-end gap-3"
        onSubmit={async (e) => {
          e.preventDefault();
          if (!name.trim()) return;
          await api.createExpenseCategory({ name: name.trim(), is_fixed: fixed });
          setName('');
          setFixed(false);
          onChange();
        }}
      >
        <div className="min-w-[200px] flex-1">
          <Field label={c('name')}>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={t('categoryPlaceholder')} />
          </Field>
        </div>
        <label className="mb-2.5 flex items-center gap-2 text-sm text-ink">
          <input type="checkbox" checked={fixed} onChange={(e) => setFixed(e.target.checked)} />
          {t('isFixed')}
        </label>
        <Button type="submit" className="mb-0.5">
          {c('add')}
        </Button>
      </form>

      {categories.length === 0 ? (
        <p className="text-sm text-muted">{t('noCategories')}</p>
      ) : (
        <ul className="divide-y divide-line">
          {categories.map((cat) => (
            <li key={cat.id} className="flex items-center justify-between py-2 text-sm">
              <span className="text-ink">
                {cat.name}
                {cat.is_fixed && <span className="ml-2 text-xs text-muted">· {t('isFixed')}</span>}
              </span>
              <span className="flex items-center gap-3">
                <span className="text-xs text-muted">{t('usedIn', { count: cat.expenses_count ?? 0 })}</span>
                <button
                  type="button"
                  className="text-xs font-semibold text-red-600 hover:underline"
                  onClick={async () => {
                    await api.deleteExpenseCategory(cat.id);
                    onChange();
                  }}
                >
                  {c('delete')}
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
