'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { AdminShell } from '@/components/AdminShell';
import { BalanceTag, Gated, Kpi, Select, money } from '@/components/finance-kit';
import { Button, Card, Field, Input } from '@/components/ui';
import { useApi } from '@/lib/useApi';

export default function AccountsPage() {
  const t = useTranslations('accounts');
  const c = useTranslations('common');
  const { api, me, ready } = useApi();
  const currency = me?.tenant?.currency ?? 'TRY';

  const [accounts, setAccounts] = useState<any[]>([]);
  const [filter, setFilter] = useState('');
  const [gated, setGated] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [openId, setOpenId] = useState<number | null>(null);

  const load = useCallback(async () => {
    try {
      setAccounts((await api.adminAccounts(filter ? { type: filter } : {})) ?? []);
      setGated(false);
    } catch {
      setGated(true);
    }
  }, [api, filter]);

  useEffect(() => {
    if (ready) load();
  }, [ready, load]);

  const receivable = accounts.filter((a) => Number(a.balance) > 0).reduce((s, a) => s + Number(a.balance), 0);
  const payable = accounts.filter((a) => Number(a.balance) < 0).reduce((s, a) => s + Math.abs(Number(a.balance)), 0);
  const tags = { receivable: t('owesUs'), payable: t('weOwe'), clear: t('clear') };

  return (
    <AdminShell title={t('title')}>
      {gated ? (
        <Gated message={t('gated')} />
      ) : (
        <>
          <div className="mb-5 grid gap-4 sm:grid-cols-3">
            <Kpi label={t('totalReceivable')} value={money(receivable, currency)} tone="good" sub={t('receivableHint')} />
            <Kpi label={t('totalPayable')} value={money(payable, currency)} tone="bad" sub={t('payableHint')} />
            <div className="rounded-2xl border border-line bg-surface p-5 shadow-sm">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">{t('filterType')}</p>
              <Select value={filter} onChange={setFilter}>
                <option value="">{c('all')}</option>
                <option value="supplier">{t('type_supplier')}</option>
                <option value="customer">{t('type_customer')}</option>
                <option value="staff">{t('type_staff')}</option>
                <option value="other">{t('type_other')}</option>
              </Select>
            </div>
          </div>

          <div className="mb-5">
            <Button onClick={() => setShowForm((v) => !v)}>{showForm ? c('close') : t('addAccount')}</Button>
          </div>

          {showForm && (
            <AccountForm
              api={api}
              onDone={() => {
                setShowForm(false);
                load();
              }}
            />
          )}

          <Card className="mt-5">
            {accounts.length === 0 ? (
              <p className="text-sm text-muted">{t('noAccounts')}</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
                      <th className="py-2">{c('name')}</th>
                      <th>{t('type')}</th>
                      <th>{t('phone')}</th>
                      <th className="text-right">{t('creditLimit')}</th>
                      <th className="text-right">{t('balance')}</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {accounts.map((a) => (
                      <tr key={a.id} className="border-b border-line/60">
                        <td className="py-2.5 font-medium text-ink">{a.name}</td>
                        <td className="text-muted">{t(`type_${a.type}` as never)}</td>
                        <td className="text-muted">{a.phone ?? '—'}</td>
                        <td className="text-right tabular-nums text-muted">
                          {Number(a.credit_limit) > 0 ? money(a.credit_limit, currency) : t('noLimit')}
                        </td>
                        <td className="text-right">
                          <BalanceTag value={Number(a.balance)} currency={currency} labels={tags} />
                        </td>
                        <td className="text-right">
                          <button
                            type="button"
                            className="text-xs font-semibold text-brand-600 hover:underline"
                            onClick={() => setOpenId(openId === a.id ? null : a.id)}
                          >
                            {openId === a.id ? c('close') : t('ledger')}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          {openId && (
            <AccountLedgerPanel
              api={api}
              account={accounts.find((a) => a.id === openId)}
              currency={currency}
              onChange={load}
            />
          )}
        </>
      )}
    </AdminShell>
  );
}

function AccountForm({ api, onDone }: { api: any; onDone: () => void }) {
  const t = useTranslations('accounts');
  const c = useTranslations('common');
  const [f, setF] = useState<Record<string, string>>({ type: 'supplier' });
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
            await api.createAccount({
              name: f.name,
              type: f.type,
              phone: f.phone || null,
              email: f.email || null,
              tax_no: f.tax_no || null,
              credit_limit: Number(f.credit_limit || 0),
              opening_balance: Number(f.opening_balance || 0),
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
          <Input required value={f.name ?? ''} onChange={(e) => set('name', e.target.value)} />
        </Field>
        <Field label={t('type')}>
          <Select value={f.type} onChange={(v) => set('type', v)}>
            <option value="supplier">{t('type_supplier')}</option>
            <option value="customer">{t('type_customer')}</option>
            <option value="staff">{t('type_staff')}</option>
            <option value="other">{t('type_other')}</option>
          </Select>
        </Field>
        <Field label={t('phone')}>
          <Input value={f.phone ?? ''} onChange={(e) => set('phone', e.target.value)} />
        </Field>
        <Field label={t('creditLimit')} hint={t('creditLimitHint')}>
          <Input type="number" step="0.01" min="0" value={f.credit_limit ?? ''} onChange={(e) => set('credit_limit', e.target.value)} />
        </Field>
        <Field label={t('openingBalance')} hint={t('openingHint')}>
          <Input type="number" step="0.01" value={f.opening_balance ?? ''} onChange={(e) => set('opening_balance', e.target.value)} />
        </Field>
        <Field label={t('taxNo')}>
          <Input value={f.tax_no ?? ''} onChange={(e) => set('tax_no', e.target.value)} />
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

/** Ledger + tahsilat/ödeme entry for one account. */
function AccountLedgerPanel({
  api,
  account,
  currency,
  onChange,
}: {
  api: any;
  account: any;
  currency: string;
  onChange: () => void;
}) {
  const t = useTranslations('accounts');
  const c = useTranslations('common');
  const [rows, setRows] = useState<any[]>([]);
  const [amount, setAmount] = useState('');
  const [direction, setDirection] = useState('collect');
  const [method, setMethod] = useState('cash');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const res = await api.accountTransactions(account.id);
    setRows(res?.data ?? []);
  }, [api, account.id]);

  useEffect(() => {
    load();
  }, [load]);

  if (!account) return null;

  return (
    <Card className="mt-5">
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-base font-semibold text-ink">
          {account.name} · {t('ledger')}
        </h2>
        <span className="text-sm text-muted">
          {t('balance')}: <b className="text-ink">{money(account.balance, currency)}</b>
        </span>
      </div>

      <form
        className="mb-5 flex flex-wrap items-end gap-3 rounded-xl border border-line bg-canvas p-4"
        onSubmit={async (e) => {
          e.preventDefault();
          setSaving(true);
          setError(null);
          try {
            await api.postAccountTransaction(account.id, {
              direction,
              amount: Number(amount),
              method,
            });
            setAmount('');
            await load();
            onChange();
          } catch (err: any) {
            setError(err?.message ?? c('error'));
          } finally {
            setSaving(false);
          }
        }}
      >
        <div className="w-44">
          <Field label={t('movement')}>
            <Select value={direction} onChange={setDirection}>
              <option value="collect">{t('dir_collect')}</option>
              <option value="settle">{t('dir_settle')}</option>
              <option value="charge">{t('dir_charge')}</option>
            </Select>
          </Field>
        </div>
        <div className="w-40">
          <Field label={t('amount')}>
            <Input type="number" step="0.01" min="0.01" required value={amount} onChange={(e) => setAmount(e.target.value)} />
          </Field>
        </div>
        <div className="w-40">
          <Field label={t('method')}>
            <Select value={method} onChange={setMethod}>
              <option value="cash">{t('m_cash')}</option>
              <option value="card">{t('m_card')}</option>
              <option value="transfer">{t('m_transfer')}</option>
            </Select>
          </Field>
        </div>
        <Button type="submit" loading={saving} className="mb-0.5">
          {t('record')}
        </Button>
        {error && <p className="w-full text-sm text-red-600">{error}</p>}
      </form>

      {rows.length === 0 ? (
        <p className="text-sm text-muted">{t('noMovements')}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
                <th className="py-2">{c('date')}</th>
                <th>{t('movement')}</th>
                <th>{c('description')}</th>
                <th className="text-right">{t('amount')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-line/60">
                  <td className="py-2 whitespace-nowrap text-muted">{String(r.occurred_on).slice(0, 10)}</td>
                  <td className="text-ink">{t(`tx_${r.type}` as never)}</td>
                  <td className="text-muted">{r.note ?? '—'}</td>
                  <td className={`text-right tabular-nums font-semibold ${Number(r.amount) > 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                    {Number(r.amount) > 0 ? '+' : '−'}
                    {money(Math.abs(Number(r.amount)), currency)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
