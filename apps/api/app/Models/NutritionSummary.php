<?php

namespace App\Models;

use App\Models\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Derived, cached nutrition + cost summary for a product (M2, docs/03 §3.2).
 * Written by the RecomputeNutrition job; read by the public menu.
 */
class NutritionSummary extends Model
{
    use BelongsToTenant;

    protected $fillable = [
        'tenant_id', 'product_id',
        'per_portion_kcal', 'protein_g', 'carb_g', 'fat_g',
        'saturated_fat_g', 'sugar_g', 'fiber_g', 'sodium_mg',
        'allergen_ids_json', 'diet_flags_json',
        'cost_per_portion', 'suggested_price', 'margin_pct',
        'computed_at', 'is_stale',
    ];

    protected function casts(): array
    {
        return [
            'per_portion_kcal' => 'float',
            'protein_g' => 'float',
            'carb_g' => 'float',
            'fat_g' => 'float',
            'saturated_fat_g' => 'float',
            'sugar_g' => 'float',
            'fiber_g' => 'float',
            'sodium_mg' => 'float',
            'allergen_ids_json' => 'array',
            'diet_flags_json' => 'array',
            'cost_per_portion' => 'float',
            'suggested_price' => 'float',
            'margin_pct' => 'float',
            'is_stale' => 'boolean',
            'computed_at' => 'datetime',
        ];
    }

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }
}
