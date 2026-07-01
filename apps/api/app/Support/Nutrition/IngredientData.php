<?php

namespace App\Support\Nutrition;

/**
 * Plain, DB-free ingredient snapshot the {@see NutritionCalculator} consumes.
 * Keeps the engine pure and unit-testable (docs/03 §3.3).
 */
final class IngredientData
{
    /**
     * @param  array<string,float>  $nutrientsPer100  keyed by Ingredient::NUTRIENTS
     * @param  array<int,int>  $allergenContains
     * @param  array<int,int>  $allergenTraces
     */
    public function __construct(
        public readonly string $unit,            // g | ml | adet
        public readonly ?float $gramsPerUnit,    // required when unit = adet
        public readonly array $nutrientsPer100,
        public readonly float $unitCost,
        public readonly string $costUnit,        // kg | g | l | ml | adet …
        public readonly float $wastePct,
        public readonly bool $isVegan,
        public readonly bool $isVegetarian,
        public readonly bool $isGlutenFree,
        public readonly array $allergenContains = [],
        public readonly array $allergenTraces = [],
    ) {}
}
