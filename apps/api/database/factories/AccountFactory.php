<?php

namespace Database\Factories;

use App\Models\Account;
use App\Models\Tenant;
use App\Support\Tenancy\TenantManager;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Account>
 */
class AccountFactory extends Factory
{
    public function definition(): array
    {
        return [
            'tenant_id' => app(TenantManager::class)->id() ?? Tenant::factory(),
            'type' => 'supplier',
            'name' => fake()->company(),
            'credit_limit' => 0,
            'opening_balance' => 0,
            'balance' => 0,
            'is_active' => true,
        ];
    }

    public function customer(): static
    {
        return $this->state(fn () => ['type' => 'customer', 'name' => fake()->name()]);
    }

    /** Veresiye tavanı olan cari. */
    public function withLimit(float $limit): static
    {
        return $this->state(fn () => ['credit_limit' => $limit]);
    }
}
