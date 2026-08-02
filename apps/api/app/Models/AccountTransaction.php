<?php

namespace App\Models;

use App\Models\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * One line of a current-account ledger (Faz 4). `amount` is the SIGNED delta the
 * row applied to the account balance (+ = they owe us more, − = we owe them more),
 * so the balance is always re-derivable by summing this column.
 */
class AccountTransaction extends Model
{
    use BelongsToTenant;

    /** charge: veresiye satış · collect: tahsilat · purchase: vadeli alım · settle: tedarikçiye ödeme */
    public const TYPES = ['charge', 'collect', 'purchase', 'settle', 'opening', 'adjustment'];

    protected $fillable = [
        'tenant_id', 'account_id', 'type', 'amount', 'method',
        'order_id', 'expense_id', 'occurred_on', 'note', 'created_by',
    ];

    protected function casts(): array
    {
        return [
            'amount' => 'decimal:2',
            // Y-m-d — see Expense::casts(); a UTC-serialised date shifts the ledger day.
            'occurred_on' => 'date:Y-m-d',
        ];
    }

    public function account(): BelongsTo
    {
        return $this->belongsTo(Account::class);
    }

    public function order(): BelongsTo
    {
        return $this->belongsTo(Order::class);
    }

    public function expense(): BelongsTo
    {
        return $this->belongsTo(Expense::class);
    }
}
