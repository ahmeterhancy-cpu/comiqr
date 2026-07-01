<?php

namespace Database\Factories;

use App\Models\ModifierGroup;
use App\Models\Tenant;
use App\Support\Tenancy\TenantManager;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<ModifierGroup>
 */
class ModifierGroupFactory extends Factory
{
    public function definition(): array
    {
        return [
            'tenant_id' => app(TenantManager::class)->id() ?? Tenant::factory(),
            'name' => fake()->randomElement(['Pişme Derecesi', 'Ekstra Malzeme', 'Sos Seçimi', 'Porsiyon']),
            'min_select' => 0,
            'max_select' => 1,
            'is_required' => false,
        ];
    }
}
