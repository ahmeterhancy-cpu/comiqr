<?php

namespace App\Http\Resources;

use App\Models\Ingredient;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin Ingredient */
class IngredientResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'name' => $this->name,
            'unit' => $this->unit,
            'grams_per_unit' => $this->grams_per_unit,
            'nutrition_per_100' => [
                'kcal' => $this->kcal,
                'protein_g' => $this->protein_g,
                'carb_g' => $this->carb_g,
                'fat_g' => $this->fat_g,
                'saturated_fat_g' => $this->saturated_fat_g,
                'sugar_g' => $this->sugar_g,
                'fiber_g' => $this->fiber_g,
                'sodium_mg' => $this->sodium_mg,
            ],
            'unit_cost' => $this->unit_cost,
            'cost_unit' => $this->cost_unit,
            'waste_pct' => $this->waste_pct,
            'diet' => [
                'is_vegan' => $this->is_vegan,
                'is_vegetarian' => $this->is_vegetarian,
                'is_gluten_free' => $this->is_gluten_free,
            ],
            'allergens' => $this->whenLoaded('allergens', fn () => $this->allergens->map(fn ($a) => [
                'id' => $a->id,
                'code' => $a->code,
                'name' => $a->name,
                'trace' => (bool) $a->pivot->trace,
            ])),
            'stock_qty' => $this->stock_qty,
            'data_source' => $this->data_source,
        ];
    }
}
