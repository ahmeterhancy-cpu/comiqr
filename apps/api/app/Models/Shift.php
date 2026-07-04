<?php

namespace App\Models;

use App\Models\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * A POS cash-drawer shift (Faz 3 — ultra POS). Opened with a starting float,
 * accrues cash/card sales while open, and closes into a Z-report (expected vs
 * counted cash → over/short). Tenant-scoped; one open shift per branch.
 */
class Shift extends Model
{
    use BelongsToTenant;

    protected $fillable = [
        'tenant_id', 'branch_id', 'opened_by', 'closed_by', 'status',
        'opening_float', 'counted_cash', 'expected_cash',
        'cash_sales', 'card_sales', 'other_sales', 'over_short', 'orders_count',
        'note', 'opened_at', 'closed_at',
    ];

    protected function casts(): array
    {
        return [
            'opening_float' => 'decimal:2',
            'counted_cash' => 'decimal:2',
            'expected_cash' => 'decimal:2',
            'cash_sales' => 'decimal:2',
            'card_sales' => 'decimal:2',
            'other_sales' => 'decimal:2',
            'over_short' => 'decimal:2',
            'opened_at' => 'datetime',
            'closed_at' => 'datetime',
        ];
    }

    public function openedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'opened_by');
    }

    public function branch(): BelongsTo
    {
        return $this->belongsTo(Branch::class);
    }
}
