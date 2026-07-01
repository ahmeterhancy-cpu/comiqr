<?php

namespace App\Models;

use App\Models\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * Recipe for a product (M2, docs/03 §3.2). Tenant-scoped, one per product.
 */
class Recipe extends Model
{
    /** @use HasFactory<\Database\Factories\RecipeFactory> */
    use BelongsToTenant, HasFactory;

    protected $fillable = ['tenant_id', 'product_id', 'yield_portions', 'prep_minutes', 'notes'];

    protected function casts(): array
    {
        return [
            'yield_portions' => 'integer',
            'prep_minutes' => 'integer',
        ];
    }

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }

    public function items(): HasMany
    {
        return $this->hasMany(RecipeItem::class);
    }
}
