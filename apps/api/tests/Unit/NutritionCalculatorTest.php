<?php

use App\Support\Nutrition\IngredientData;
use App\Support\Nutrition\NutritionCalculator;

/**
 * The nutrition engine is the product's differentiating core (docs/03 §3.3),
 * so its arithmetic is pinned with hand-computed expectations.
 */

function ing(array $overrides = []): IngredientData
{
    return new IngredientData(
        unit: $overrides['unit'] ?? 'g',
        gramsPerUnit: $overrides['gramsPerUnit'] ?? null,
        nutrientsPer100: array_merge([
            'kcal' => 0, 'protein_g' => 0, 'carb_g' => 0, 'fat_g' => 0,
            'saturated_fat_g' => 0, 'sugar_g' => 0, 'fiber_g' => 0, 'sodium_mg' => 0,
        ], $overrides['nutrientsPer100'] ?? []),
        unitCost: $overrides['unitCost'] ?? 0.0,
        costUnit: $overrides['costUnit'] ?? 'kg',
        wastePct: $overrides['wastePct'] ?? 0.0,
        isVegan: $overrides['isVegan'] ?? true,
        isVegetarian: $overrides['isVegetarian'] ?? true,
        isGlutenFree: $overrides['isGlutenFree'] ?? true,
        allergenContains: $overrides['allergenContains'] ?? [],
        allergenTraces: $overrides['allergenTraces'] ?? [],
    );
}

it('computes per-portion nutrition and cost for a single ingredient', function () {
    $calc = new NutritionCalculator;

    $result = $calc->calculate(
        yieldPortions: 2,
        items: [[
            'ingredient' => ing([
                'nutrientsPer100' => [
                    'kcal' => 200, 'protein_g' => 10, 'carb_g' => 20, 'fat_g' => 8,
                    'saturated_fat_g' => 3, 'sugar_g' => 5, 'fiber_g' => 2, 'sodium_mg' => 400,
                ],
                'unitCost' => 50, 'costUnit' => 'kg',
            ]),
            'quantity' => 300, 'unit' => 'g',
        ]],
        productPrice: 30,
    );

    // factor = 300/100 = 3 → totals, divided by 2 portions.
    expect($result['per_portion_kcal'])->toBe(300.0)
        ->and($result['protein_g'])->toBe(15.0)
        ->and($result['carb_g'])->toBe(30.0)
        ->and($result['fat_g'])->toBe(12.0)
        ->and($result['saturated_fat_g'])->toBe(4.5)
        ->and($result['sugar_g'])->toBe(7.5)
        ->and($result['fiber_g'])->toBe(3.0)
        ->and($result['sodium_mg'])->toBe(600.0)
        // cost: 300 g = 0.3 kg × 50 = 15 → /2 = 7.5; suggested 7.5/0.3 = 25; margin 75%.
        ->and($result['cost_per_portion'])->toBe(7.5)
        ->and($result['suggested_price'])->toBe(25.0)
        ->and($result['margin_pct'])->toBe(75.0)
        ->and($result['diet_flags_json']['vegan'])->toBeTrue();
});

it('sums multiple ingredients, applies waste to cost, and handles adet units', function () {
    $calc = new NutritionCalculator;

    $result = $calc->calculate(
        yieldPortions: 1,
        items: [
            [
                'ingredient' => ing([
                    'nutrientsPer100' => ['kcal' => 100],
                    'unitCost' => 20, 'costUnit' => 'kg', 'wastePct' => 10,
                ]),
                'quantity' => 200, 'unit' => 'g',
            ],
            [
                'ingredient' => ing([
                    'unit' => 'adet', 'gramsPerUnit' => 50,
                    'nutrientsPer100' => ['kcal' => 150],
                    'unitCost' => 2, 'costUnit' => 'adet',
                    'isVegan' => false, 'allergenContains' => [3],
                ]),
                'quantity' => 2, 'unit' => 'adet',
            ],
        ],
        productPrice: 40,
    );

    // kcal: 200g→factor 2 ×100 = 200; 2 adet ×50g = 100g→factor 1 ×150 = 150 → 350.
    // cost: A 200×1.1=220g=0.22kg×20 = 4.4; B 2×2 = 4 → 8.4.
    expect($result['per_portion_kcal'])->toBe(350.0)
        ->and($result['cost_per_portion'])->toBe(8.4)
        ->and($result['suggested_price'])->toBe(28.0)
        ->and($result['margin_pct'])->toBe(79.0)
        ->and($result['diet_flags_json']['vegan'])->toBeFalse()
        ->and($result['diet_flags_json']['vegetarian'])->toBeTrue()
        ->and($result['diet_flags_json']['gluten_free'])->toBeTrue()
        ->and($result['allergen_ids_json']['contains'])->toBe([3]);
});

it('derives diet flags as the AND across all ingredients', function () {
    $calc = new NutritionCalculator;

    $result = $calc->calculate(1, [
        ['ingredient' => ing(['isGlutenFree' => false]), 'quantity' => 100, 'unit' => 'g'],
        ['ingredient' => ing(), 'quantity' => 100, 'unit' => 'g'],
    ]);

    expect($result['diet_flags_json']['gluten_free'])->toBeFalse()
        ->and($result['diet_flags_json']['vegan'])->toBeTrue();
});

it('keeps a trace allergen but drops it when the same allergen is also contained', function () {
    $calc = new NutritionCalculator;

    $result = $calc->calculate(1, [
        ['ingredient' => ing(['allergenContains' => [1], 'allergenTraces' => [7]]), 'quantity' => 100, 'unit' => 'g'],
        ['ingredient' => ing(['allergenTraces' => [1, 9]]), 'quantity' => 100, 'unit' => 'g'],
    ]);

    expect($result['allergen_ids_json']['contains'])->toBe([1])
        ->and($result['allergen_ids_json']['traces'])->toEqualCanonicalizing([7, 9]);
});

it('rejects incompatible recipe/ingredient units', function () {
    $calc = new NutritionCalculator;

    expect(fn () => $calc->calculate(1, [
        ['ingredient' => ing(['unit' => 'g']), 'quantity' => 100, 'unit' => 'ml'],
    ]))->toThrow(InvalidArgumentException::class);
});

it('requires grams_per_unit for adet ingredients', function () {
    $calc = new NutritionCalculator;

    expect(fn () => $calc->calculate(1, [
        ['ingredient' => ing(['unit' => 'adet', 'gramsPerUnit' => null]), 'quantity' => 2, 'unit' => 'adet'],
    ]))->toThrow(InvalidArgumentException::class);
});

it('returns zeros and false diet flags for an empty recipe', function () {
    $calc = new NutritionCalculator;

    $result = $calc->calculate(4, []);

    expect($result['per_portion_kcal'])->toBe(0.0)
        ->and($result['cost_per_portion'])->toBe(0.0)
        ->and($result['diet_flags_json']['vegan'])->toBeFalse()
        ->and($result['allergen_ids_json']['contains'])->toBe([]);
});

it('scales cost from grams to a kilogram cost unit correctly', function () {
    $calc = new NutritionCalculator;

    // 500 g at 40 TL/kg, no waste, 1 portion → 0.5 kg × 40 = 20.
    $result = $calc->calculate(1, [
        ['ingredient' => ing(['unitCost' => 40, 'costUnit' => 'kg']), 'quantity' => 500, 'unit' => 'g'],
    ]);

    expect($result['cost_per_portion'])->toBe(20.0);
});
