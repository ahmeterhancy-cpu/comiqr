<?php

namespace App\Support\Nutrition;

use App\Models\Ingredient;
use App\Models\Recipe;
use InvalidArgumentException;

/**
 * The nutrition & cost engine (docs/03 §3.3) — the product's differentiating
 * core. Pure and unit-tested: given a recipe's ingredients and quantities it
 * derives per-portion nutrition, the allergen union, diet flags, and cost.
 *
 * Never called on the public menu read path; a queue job writes the result to
 * `nutrition_summaries`, which the menu reads (docs/03 §3.3).
 */
final class NutritionCalculator
{
    public const DEFAULT_FOOD_COST_RATIO = 0.30;

    /**
     * @param  array<int,array{ingredient:IngredientData,quantity:float,unit:string}>  $items
     * @return array<string,mixed> matching nutrition_summaries columns
     */
    public function calculate(
        int $yieldPortions,
        array $items,
        ?float $productPrice = null,
        float $foodCostRatio = self::DEFAULT_FOOD_COST_RATIO,
    ): array {
        $portions = max(1, $yieldPortions);

        $totals = array_fill_keys(Ingredient::NUTRIENTS, 0.0);
        $totalCost = 0.0;
        $contains = [];
        $traces = [];

        $hasItems = count($items) > 0;
        $vegan = $vegetarian = $glutenFree = $hasItems;

        foreach ($items as $item) {
            /** @var IngredientData $ing */
            $ing = $item['ingredient'];
            $qty = (float) $item['quantity'];
            $unit = $item['unit'];

            if (! UnitConverter::sameFamily($unit, $ing->unit)) {
                throw new InvalidArgumentException(
                    "Recipe unit '{$unit}' is incompatible with ingredient unit '{$ing->unit}'.",
                );
            }

            $qtyCanonical = UnitConverter::toCanonical($qty, $unit);

            // Grams/millilitres actually consumed (for nutrition per-100 scaling).
            if (UnitConverter::family($ing->unit) === 'count') {
                if (! $ing->gramsPerUnit || $ing->gramsPerUnit <= 0) {
                    throw new InvalidArgumentException(
                        "Ingredient measured in 'adet' requires grams_per_unit to compute nutrition.",
                    );
                }
                $gramsOrMl = $qtyCanonical * $ing->gramsPerUnit;
            } else {
                $gramsOrMl = $qtyCanonical;
            }

            $factor = $gramsOrMl / 100.0;
            foreach (Ingredient::NUTRIENTS as $n) {
                $totals[$n] += ($ing->nutrientsPer100[$n] ?? 0.0) * $factor;
            }

            // Cost includes waste; convert the effective canonical qty into cost_unit.
            $qtyEffective = $qtyCanonical * (1 + $ing->wastePct / 100.0);
            if (! UnitConverter::sameFamily($ing->costUnit, $ing->unit)) {
                throw new InvalidArgumentException(
                    "Ingredient cost_unit '{$ing->costUnit}' is incompatible with unit '{$ing->unit}'.",
                );
            }
            $qtyInCostUnit = UnitConverter::fromCanonical($qtyEffective, $ing->costUnit);
            $totalCost += $qtyInCostUnit * $ing->unitCost;

            $contains = array_merge($contains, $ing->allergenContains);
            $traces = array_merge($traces, $ing->allergenTraces);

            $vegan = $vegan && $ing->isVegan;
            $vegetarian = $vegetarian && $ing->isVegetarian;
            $glutenFree = $glutenFree && $ing->isGlutenFree;
        }

        $contains = array_values(array_unique($contains));
        // A confirmed allergen outranks a trace of the same allergen.
        $traces = array_values(array_diff(array_unique($traces), $contains));

        $costPerPortion = $totalCost / $portions;
        $suggestedPrice = $foodCostRatio > 0 ? $costPerPortion / $foodCostRatio : null;
        $marginPct = ($productPrice !== null && $productPrice > 0)
            ? (($productPrice - $costPerPortion) / $productPrice) * 100
            : null;

        return [
            'per_portion_kcal' => $this->round($totals['kcal'] / $portions),
            'protein_g' => $this->round($totals['protein_g'] / $portions),
            'carb_g' => $this->round($totals['carb_g'] / $portions),
            'fat_g' => $this->round($totals['fat_g'] / $portions),
            'saturated_fat_g' => $this->round($totals['saturated_fat_g'] / $portions),
            'sugar_g' => $this->round($totals['sugar_g'] / $portions),
            'fiber_g' => $this->round($totals['fiber_g'] / $portions),
            'sodium_mg' => $this->round($totals['sodium_mg'] / $portions),
            'allergen_ids_json' => ['contains' => $contains, 'traces' => $traces],
            'diet_flags_json' => [
                'vegan' => $vegan,
                'vegetarian' => $vegetarian,
                'gluten_free' => $glutenFree,
            ],
            'cost_per_portion' => $this->round($costPerPortion),
            'suggested_price' => $suggestedPrice === null ? null : $this->round($suggestedPrice),
            'margin_pct' => $marginPct === null ? null : $this->round($marginPct),
        ];
    }

    /**
     * Build the calculator input from a persisted recipe and run it. The recipe's
     * items and their ingredients (with allergens) should be eager-loaded.
     *
     * @return array<string,mixed>
     */
    public function forRecipe(Recipe $recipe, ?float $productPrice = null, ?float $foodCostRatio = null): array
    {
        $items = $recipe->items->map(function ($item) {
            /** @var Ingredient $ing */
            $ing = $item->ingredient;

            $contains = [];
            $traces = [];
            foreach ($ing->allergens as $allergen) {
                if ($allergen->pivot->trace) {
                    $traces[] = $allergen->id;
                } else {
                    $contains[] = $allergen->id;
                }
            }

            $nutrients = [];
            foreach (Ingredient::NUTRIENTS as $n) {
                $nutrients[$n] = (float) $ing->{$n};
            }

            return [
                'ingredient' => new IngredientData(
                    unit: $ing->unit,
                    gramsPerUnit: $ing->grams_per_unit,
                    nutrientsPer100: $nutrients,
                    unitCost: (float) $ing->unit_cost,
                    costUnit: $ing->cost_unit,
                    wastePct: (float) $ing->waste_pct,
                    isVegan: (bool) $ing->is_vegan,
                    isVegetarian: (bool) $ing->is_vegetarian,
                    isGlutenFree: (bool) $ing->is_gluten_free,
                    allergenContains: $contains,
                    allergenTraces: $traces,
                ),
                'quantity' => (float) $item->quantity,
                'unit' => $item->unit,
            ];
        })->all();

        return $this->calculate(
            (int) $recipe->yield_portions,
            $items,
            $productPrice,
            $foodCostRatio ?? self::DEFAULT_FOOD_COST_RATIO,
        );
    }

    private function round(float $value): float
    {
        return round($value, 2);
    }
}
