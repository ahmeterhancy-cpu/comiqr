<?php

namespace Database\Factories;

use App\Models\Coupon;
use App\Models\Tenant;
use App\Support\Tenancy\TenantManager;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/**
 * @extends Factory<Coupon>
 */
class CouponFactory extends Factory
{
    public function definition(): array
    {
        return [
            'tenant_id' => app(TenantManager::class)->id() ?? Tenant::factory(),
            'code' => Str::upper(Str::random(8)),
            'type' => 'percent',
            'value' => 10,
            'is_active' => true,
        ];
    }
}
