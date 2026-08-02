<?php

namespace App\Models;

use App\Models\Concerns\BelongsToTenant;
use Database\Factories\ExpenseFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;

/**
 * An expense (Faz 4 — gider yönetimi). Tenant-scoped. `amount` excludes tax;
 * `tax_amount` carries the VAT so the report can show both the net cost that
 * hits profit and the gross cash that left the till.
 */
class Expense extends Model
{
    /** @use HasFactory<ExpenseFactory> */
    use BelongsToTenant, HasFactory, SoftDeletes;

    public const METHODS = ['cash', 'card', 'transfer', 'credit'];

    protected $fillable = [
        'tenant_id', 'branch_id', 'expense_category_id', 'account_id', 'description',
        'amount', 'tax_amount', 'payment_method', 'spent_on', 'document_no', 'note', 'created_by',
    ];

    protected function casts(): array
    {
        return [
            'amount' => 'decimal:2',
            'tax_amount' => 'decimal:2',
            // Y-m-d, not a datetime: the default `date` cast serialises to UTC and a
            // +03 venue would read its own expense back a day early.
            'spent_on' => 'date:Y-m-d',
        ];
    }

    /** Cash actually paid out (net + VAT). */
    public function total(): float
    {
        return round((float) $this->amount + (float) $this->tax_amount, 2);
    }

    public function category(): BelongsTo
    {
        return $this->belongsTo(ExpenseCategory::class, 'expense_category_id');
    }

    public function account(): BelongsTo
    {
        return $this->belongsTo(Account::class);
    }

    public function branch(): BelongsTo
    {
        return $this->belongsTo(Branch::class);
    }
}
