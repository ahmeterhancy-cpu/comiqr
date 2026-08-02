<?php

namespace Database\Factories;

use App\Models\Expense;
use App\Models\Tenant;
use App\Support\Tenancy\TenantManager;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Expense>
 */
class ExpenseFactory extends Factory
{
    public function definition(): array
    {
        return [
            'tenant_id' => app(TenantManager::class)->id() ?? Tenant::factory(),
            'description' => fake()->sentence(3),
            'amount' => fake()->randomFloat(2, 50, 5000),
            'tax_amount' => 0,
            'payment_method' => 'cash',
            'spent_on' => now()->toDateString(),
        ];
    }
}
