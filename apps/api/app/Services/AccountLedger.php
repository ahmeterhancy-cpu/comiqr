<?php

namespace App\Services;

use App\Models\Account;
use App\Models\AccountTransaction;
use App\Models\Expense;
use App\Models\Order;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * The only writer of current-account balances (Faz 4 — cari hesap).
 *
 * Every movement is a ledger row carrying the SIGNED delta it applied, so the
 * cached `accounts.balance` is always opening_balance + SUM(amount) and can be
 * rebuilt with {@see recalculate()}. Balances are signed from our point of view:
 * positive = they owe us, negative = we owe them.
 *
 * Writes take a row lock on the account, so two concurrent veresiye charges
 * cannot both slip under the same credit ceiling.
 */
class AccountLedger
{
    /** Veresiye satış — the guest now owes us more. */
    public function charge(Account $account, float $amount, array $meta = []): AccountTransaction
    {
        return $this->post($account, 'charge', abs($amount), $meta);
    }

    /** Tahsilat — the guest paid down what they owed. */
    public function collect(Account $account, float $amount, array $meta = []): AccountTransaction
    {
        return $this->post($account, 'collect', -abs($amount), $meta);
    }

    /** Vadeli alım — we now owe the supplier more. */
    public function purchase(Account $account, float $amount, array $meta = []): AccountTransaction
    {
        return $this->post($account, 'purchase', -abs($amount), $meta);
    }

    /** Tedarikçiye ödeme — we paid down what we owed. */
    public function settle(Account $account, float $amount, array $meta = []): AccountTransaction
    {
        return $this->post($account, 'settle', abs($amount), $meta);
    }

    /**
     * Apply a signed delta to an account and record it. `$meta` may carry
     * method, order_id, expense_id, occurred_on and note.
     *
     * @param  array<string,mixed>  $meta
     */
    public function post(Account $account, string $type, float $delta, array $meta = []): AccountTransaction
    {
        $delta = round($delta, 2);

        if (abs($delta) < 0.01) {
            throw ValidationException::withMessages(['amount' => ['Tutar sıfır olamaz.']]);
        }

        return DB::transaction(function () use ($account, $type, $delta, $meta) {
            // Serialise concurrent movements on this account — the credit check
            // below must see every charge that already landed.
            $locked = Account::whereKey($account->id)->lockForUpdate()->firstOrFail();

            $newBalance = round((float) $locked->balance + $delta, 2);

            // Veresiye ceiling: only charges that grow a receivable are capped.
            $limit = (float) $locked->credit_limit;
            if ($delta > 0 && $limit > 0 && $newBalance > $limit + 0.001) {
                throw ValidationException::withMessages([
                    'amount' => [sprintf(
                        'Veresiye limiti aşılıyor. Limit %.2f, mevcut bakiye %.2f.',
                        $limit,
                        (float) $locked->balance,
                    )],
                ]);
            }

            $transaction = AccountTransaction::create([
                'account_id' => $locked->id,
                'type' => $type,
                'amount' => $delta,
                'method' => $meta['method'] ?? null,
                'order_id' => $meta['order_id'] ?? null,
                'expense_id' => $meta['expense_id'] ?? null,
                'occurred_on' => $meta['occurred_on'] ?? now()->toDateString(),
                'note' => $meta['note'] ?? null,
                'created_by' => $meta['created_by'] ?? Auth::id(),
            ]);

            $locked->update(['balance' => $newBalance]);
            $account->setAttribute('balance', $newBalance);

            return $transaction;
        });
    }

    /** Record an order as veresiye on an account (POS "cariye yaz"). */
    public function chargeOrder(Account $account, Order $order, float $amount, ?string $note = null): AccountTransaction
    {
        return $this->charge($account, $amount, [
            'order_id' => $order->id,
            'note' => $note ?? "Sipariş #{$order->id}",
        ]);
    }

    /** Record a credit-term expense as a supplier payable. */
    public function purchaseForExpense(Account $account, Expense $expense): AccountTransaction
    {
        return $this->purchase($account, $expense->total(), [
            'expense_id' => $expense->id,
            'occurred_on' => $expense->spent_on?->toDateString(),
            'note' => $expense->description,
        ]);
    }

    /** Rebuild the cached balance from the ledger (repair / after a deletion). */
    public function recalculate(Account $account): float
    {
        $sum = (float) $account->transactions()->sum('amount');
        $balance = round((float) $account->opening_balance + $sum, 2);
        $account->update(['balance' => $balance]);

        return $balance;
    }
}
