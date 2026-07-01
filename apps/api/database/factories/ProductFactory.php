<?php

namespace Database\Factories;

use App\Models\Category;
use App\Models\Product;
use App\Models\Tenant;
use App\Support\Tenancy\TenantManager;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Product>
 */
class ProductFactory extends Factory
{
    public function definition(): array
    {
        return [
            'tenant_id' => app(TenantManager::class)->id() ?? Tenant::factory(),
            'category_id' => Category::factory(),
            'name' => fake()->randomElement(['Hellim Izgara', 'Şeftali Kebabı', 'Molehiya', 'Kolokas', 'Baklava']),
            'description' => fake()->optional()->sentence(),
            'price' => fake()->randomFloat(2, 30, 350),
            'is_active' => true,
            'sort' => fake()->numberBetween(0, 20),
            'prep_minutes' => fake()->numberBetween(5, 40),
            'calories_display' => true,
        ];
    }

    public function forCategory(Category $category): static
    {
        return $this->state(fn () => [
            'tenant_id' => $category->tenant_id,
            'category_id' => $category->id,
        ]);
    }
}
