<?php

namespace Database\Factories;

use App\Models\Branch;
use App\Models\EightySixItem;
use App\Models\Product;
use App\Models\Tenant;
use App\Support\Tenancy\TenantManager;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<EightySixItem>
 */
class EightySixItemFactory extends Factory
{
    public function definition(): array
    {
        return [
            'tenant_id' => app(TenantManager::class)->id() ?? Tenant::factory(),
            'branch_id' => Branch::factory(),
            'product_id' => Product::factory(),
            'reason' => 'Tükendi',
        ];
    }
}
