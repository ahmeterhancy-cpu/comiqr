<?php

namespace App\Models;

use App\Models\Concerns\BelongsToTenant;
use App\Services\AccountLedger;
use Database\Factories\AccountFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

/**
 * Current account / cari hesap (Faz 4). Tenant-scoped.
 *
 * `balance` is signed from OUR point of view: positive = the counterparty owes us
 * (veresiye alacağı), negative = we owe them (tedarikçi borcu). It is a cache of
 * opening_balance + SUM(transactions.amount) and is only ever written through
 * {@see AccountLedger}.
 */
class Account extends Model
{
    /** @use HasFactory<AccountFactory> */
    use BelongsToTenant, HasFactory, SoftDeletes;

    public const TYPES = ['supplier', 'customer', 'staff', 'other'];

    protected $fillable = [
        'tenant_id', 'type', 'name', 'phone', 'email', 'tax_no', 'address', 'note',
        'credit_limit', 'opening_balance', 'balance', 'customer_id', 'is_active',
    ];

    protected function casts(): array
    {
        return [
            'credit_limit' => 'decimal:2',
            'opening_balance' => 'decimal:2',
            'balance' => 'decimal:2',
            'is_active' => 'boolean',
        ];
    }

    public function transactions(): HasMany
    {
        return $this->hasMany(AccountTransaction::class);
    }

    public function expenses(): HasMany
    {
        return $this->hasMany(Expense::class);
    }

    public function customer(): BelongsTo
    {
        return $this->belongsTo(Customer::class);
    }

    /** Headroom left under the veresiye ceiling; null when no limit is set. */
    public function creditHeadroom(): ?float
    {
        $limit = (float) $this->credit_limit;

        return $limit > 0 ? round($limit - (float) $this->balance, 2) : null;
    }
}
