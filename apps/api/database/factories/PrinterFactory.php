<?php

namespace Database\Factories;

use App\Models\Printer;
use App\Models\Tenant;
use App\Support\Tenancy\TenantManager;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Printer>
 */
class PrinterFactory extends Factory
{
    public function definition(): array
    {
        return [
            'tenant_id' => app(TenantManager::class)->id() ?? Tenant::factory(),
            'name' => 'Mutfak',
            'kind' => 'kitchen',
            'target' => '192.168.1.50:9100',
            'category_ids_json' => null,
            'copies' => 1,
            'is_active' => true,
        ];
    }

    /** Only prints the given menu categories. */
    public function forCategories(array $ids): static
    {
        return $this->state(fn () => ['category_ids_json' => $ids]);
    }
}
