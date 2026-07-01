<?php

namespace App\Http\Resources;

use App\Models\NutritionSummary;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin NutritionSummary */
class NutritionSummaryResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'kcal' => $this->per_portion_kcal,
            'macros' => [
                'protein_g' => $this->protein_g,
                'carb_g' => $this->carb_g,
                'fat_g' => $this->fat_g,
            ],
            'detail' => [
                'saturated_fat_g' => $this->saturated_fat_g,
                'sugar_g' => $this->sugar_g,
                'fiber_g' => $this->fiber_g,
                'sodium_mg' => $this->sodium_mg,
            ],
            'allergens' => $this->allergen_ids_json ?? ['contains' => [], 'traces' => []],
            'diet' => $this->diet_flags_json ?? ['vegan' => false, 'vegetarian' => false, 'gluten_free' => false],
            'is_stale' => $this->is_stale,
            'computed_at' => $this->computed_at,
        ];
    }

    /** Owner-only cost fields (not exposed on the public menu). */
    public function withCost(): array
    {
        return array_merge($this->toArray(request()), [
            'cost_per_portion' => $this->cost_per_portion,
            'suggested_price' => $this->suggested_price,
            'margin_pct' => $this->margin_pct,
        ]);
    }
}
