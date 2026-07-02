<?php

namespace Database\Factories;

use App\Models\Table;
use App\Models\TableSession;
use App\Models\Tenant;
use App\Support\Tenancy\TenantManager;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<TableSession>
 */
class TableSessionFactory extends Factory
{
    public function definition(): array
    {
        return [
            'tenant_id' => app(TenantManager::class)->id() ?? Tenant::factory(),
            'table_id' => Table::factory(),
            'status' => 'open',
            'opened_at' => now(),
            'guest_count' => fake()->numberBetween(1, 6),
        ];
    }

    public function closed(): static
    {
        return $this->state(fn () => ['status' => 'closed', 'closed_at' => now()]);
    }
}
