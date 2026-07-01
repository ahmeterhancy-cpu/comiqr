<?php

namespace App\Models;

use App\Models\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\SoftDeletes;

/**
 * Ingredient master card (M2, docs/03 §3.2). Tenant-scoped. Nutrition values are
 * per 100 g/ml; the nutrition engine scales them by recipe quantities.
 */
class Ingredient extends Model
{
    /** @use HasFactory<\Database\Factories\IngredientFactory> */
    use BelongsToTenant, HasFactory, SoftDeletes;

    protected $fillable = [
        'tenant_id', 'name', 'unit', 'grams_per_unit',
        'kcal', 'protein_g', 'carb_g', 'fat_g', 'saturated_fat_g', 'sugar_g', 'fiber_g', 'sodium_mg',
        'unit_cost', 'cost_unit', 'waste_pct',
        'is_vegan', 'is_vegetarian', 'is_gluten_free',
        'stock_qty', 'low_stock_threshold', 'data_source', 'verified_at',
    ];

    protected function casts(): array
    {
        return [
            'grams_per_unit' => 'float',
            'kcal' => 'float',
            'protein_g' => 'float',
            'carb_g' => 'float',
            'fat_g' => 'float',
            'saturated_fat_g' => 'float',
            'sugar_g' => 'float',
            'fiber_g' => 'float',
            'sodium_mg' => 'float',
            'unit_cost' => 'float',
            'waste_pct' => 'float',
            'is_vegan' => 'boolean',
            'is_vegetarian' => 'boolean',
            'is_gluten_free' => 'boolean',
            'stock_qty' => 'float',
            'low_stock_threshold' => 'float',
            'verified_at' => 'datetime',
        ];
    }

    /** Nutrition fields tracked by the engine (per 100 g/ml). */
    public const NUTRIENTS = [
        'kcal', 'protein_g', 'carb_g', 'fat_g',
        'saturated_fat_g', 'sugar_g', 'fiber_g', 'sodium_mg',
    ];

    public function allergens(): BelongsToMany
    {
        return $this->belongsToMany(Allergen::class, 'ingredient_allergen')->withPivot('trace');
    }
}
