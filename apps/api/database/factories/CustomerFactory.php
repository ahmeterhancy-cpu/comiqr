<?php

namespace Database\Factories;

use App\Models\Customer;
use App\Models\Tenant;
use App\Support\Tenancy\TenantManager;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Customer>
 */
class CustomerFactory extends Factory
{
    public function definition(): array
    {
        $phone = '+90'.fake()->numerify('5#########');

        return [
            'tenant_id' => app(TenantManager::class)->id() ?? Tenant::factory(),
            'phone' => $phone,
            'phone_hash' => Customer::hashPhone($phone),
            'name' => fake()->name(),
            'first_seen_at' => now(),
            'last_seen_at' => now(),
        ];
    }
}
