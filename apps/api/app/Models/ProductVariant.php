<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Product portion/size variant (M1). Scoped through its product's tenant.
 */
class ProductVariant extends Model
{
    protected $fillable = ['product_id', 'name', 'price_delta', 'is_default', 'sort'];

    protected function casts(): array
    {
        return [
            'price_delta' => 'decimal:2',
            'is_default' => 'boolean',
        ];
    }

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }
}
