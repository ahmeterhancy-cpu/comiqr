<?php

namespace Database\Factories;

use App\Models\Branch;
use App\Models\DiningArea;
use App\Models\Tenant;
use App\Support\Tenancy\TenantManager;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<DiningArea>
 */
class DiningAreaFactory extends Factory
{
    public function definition(): array
    {
        return [
            'tenant_id' => app(TenantManager::class)->id() ?? Tenant::factory(),
            'branch_id' => Branch::factory(),
            'name' => fake()->randomElement(['Bahçe', 'İç Salon', 'Teras', 'Sahil']),
            'type' => 'table',
        ];
    }
}
