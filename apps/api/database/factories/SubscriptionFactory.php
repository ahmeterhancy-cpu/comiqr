<?php

namespace Database\Factories;

use App\Models\Plan;
use App\Models\Subscription;
use App\Models\Tenant;
use App\Support\Tenancy\TenantManager;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Subscription>
 */
class SubscriptionFactory extends Factory
{
    public function definition(): array
    {
        return [
            'tenant_id' => app(TenantManager::class)->id() ?? Tenant::factory(),
            'plan_id' => Plan::factory(),
            'status' => 'active',
            'billing_cycle' => 'monthly',
            'current_period_end' => now()->addMonth(),
            'gateway_ref' => null,
        ];
    }
}
