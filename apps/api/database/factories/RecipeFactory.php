<?php

namespace Database\Factories;

use App\Models\Product;
use App\Models\Recipe;
use App\Models\Tenant;
use App\Support\Tenancy\TenantManager;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Recipe>
 */
class RecipeFactory extends Factory
{
    public function definition(): array
    {
        return [
            'tenant_id' => app(TenantManager::class)->id() ?? Tenant::factory(),
            'product_id' => Product::factory(),
            'yield_portions' => fake()->numberBetween(1, 8),
            'prep_minutes' => fake()->numberBetween(5, 45),
        ];
    }

    public function forProduct(Product $product): static
    {
        return $this->state(fn () => [
            'tenant_id' => $product->tenant_id,
            'product_id' => $product->id,
        ]);
    }
}
