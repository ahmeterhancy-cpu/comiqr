<?php

namespace Database\Factories;

use App\Models\ExpenseCategory;
use App\Models\Tenant;
use App\Support\Tenancy\TenantManager;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<ExpenseCategory>
 */
class ExpenseCategoryFactory extends Factory
{
    public function definition(): array
    {
        return [
            'tenant_id' => app(TenantManager::class)->id() ?? Tenant::factory(),
            'name' => fake()->unique()->words(2, true),
            'is_fixed' => false,
            'sort' => 0,
            'is_active' => true,
        ];
    }
}
