<?php

namespace App\Models;

use App\Models\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * An "86'd" (out-of-stock) product for a branch (M6, docs/05 §5.6). Hides the
 * product from the public menu until removed or `until` passes.
 */
class EightySixItem extends Model
{
    /** @use HasFactory<\Database\Factories\EightySixItemFactory> */
    use BelongsToTenant, HasFactory;

    protected $fillable = ['tenant_id', 'branch_id', 'product_id', 'reason', 'created_by', 'until'];

    protected function casts(): array
    {
        return ['until' => 'datetime'];
    }

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }

    /** Product ids currently 86'd for a branch (respecting temporary windows). */
    public static function activeProductIds(int $branchId): array
    {
        return static::query()
            ->where('branch_id', $branchId)
            ->where(fn ($q) => $q->whereNull('until')->orWhere('until', '>', now()))
            ->pluck('product_id')
            ->all();
    }
}
