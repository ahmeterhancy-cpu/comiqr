<?php

namespace App\Models;

use App\Models\Concerns\BelongsToTenant;
use Database\Factories\ExpenseCategoryFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

/**
 * Expense category (Faz 4 — gider yönetimi). Tenant-scoped; name unique per tenant.
 * `is_fixed` separates rent-like fixed costs from variable ones in the P&L report.
 */
class ExpenseCategory extends Model
{
    /** @use HasFactory<ExpenseCategoryFactory> */
    use BelongsToTenant, HasFactory, SoftDeletes;

    protected $fillable = ['tenant_id', 'name', 'color', 'is_fixed', 'sort', 'is_active'];

    protected function casts(): array
    {
        return [
            'is_fixed' => 'boolean',
            'is_active' => 'boolean',
        ];
    }

    public function expenses(): HasMany
    {
        return $this->hasMany(Expense::class);
    }
}
