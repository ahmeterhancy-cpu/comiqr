<?php

namespace Database\Factories;

use App\Models\Category;
use App\Models\Tenant;
use App\Support\Tenancy\TenantManager;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Category>
 */
class CategoryFactory extends Factory
{
    public function definition(): array
    {
        return [
            'tenant_id' => app(TenantManager::class)->id() ?? Tenant::factory(),
            'branch_id' => null,
            'parent_id' => null,
            'name' => fake()->randomElement(['Başlangıçlar', 'Ana Yemekler', 'Tatlılar', 'İçecekler', 'Mezeler']),
            'sort' => fake()->numberBetween(0, 10),
            'is_active' => true,
        ];
    }
}
