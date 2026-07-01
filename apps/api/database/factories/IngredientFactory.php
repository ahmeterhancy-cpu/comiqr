<?php

namespace Database\Factories;

use App\Models\Ingredient;
use App\Models\Tenant;
use App\Support\Tenancy\TenantManager;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Ingredient>
 */
class IngredientFactory extends Factory
{
    public function definition(): array
    {
        return [
            'tenant_id' => app(TenantManager::class)->id() ?? Tenant::factory(),
            'name' => fake()->randomElement(['Dana Kıyma', 'Hellim', 'Domates', 'Zeytinyağı', 'Bulgur', 'Nane']),
            'unit' => 'g',
            'grams_per_unit' => null,
            'kcal' => fake()->numberBetween(20, 400),
            'protein_g' => fake()->randomFloat(2, 0, 30),
            'carb_g' => fake()->randomFloat(2, 0, 60),
            'fat_g' => fake()->randomFloat(2, 0, 40),
            'saturated_fat_g' => fake()->randomFloat(2, 0, 15),
            'sugar_g' => fake()->randomFloat(2, 0, 20),
            'fiber_g' => fake()->randomFloat(2, 0, 10),
            'sodium_mg' => fake()->numberBetween(0, 800),
            'unit_cost' => fake()->randomFloat(2, 10, 300),
            'cost_unit' => 'kg',
            'waste_pct' => fake()->randomElement([0, 5, 10]),
            'is_vegan' => false,
            'is_vegetarian' => true,
            'is_gluten_free' => true,
            'data_source' => 'manual',
        ];
    }

    public function perPiece(float $gramsPerUnit): static
    {
        return $this->state(fn () => ['unit' => 'adet', 'grams_per_unit' => $gramsPerUnit, 'cost_unit' => 'adet']);
    }

    public function vegan(): static
    {
        return $this->state(fn () => ['is_vegan' => true, 'is_vegetarian' => true]);
    }
}
