<?php

namespace Database\Factories;

use App\Models\Order;
use App\Models\Payment;
use App\Models\Tenant;
use App\Support\Tenancy\TenantManager;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Payment>
 */
class PaymentFactory extends Factory
{
    public function definition(): array
    {
        return [
            'tenant_id' => app(TenantManager::class)->id() ?? Tenant::factory(),
            'order_id' => Order::factory(),
            'gateway' => 'cash',
            'amount' => fake()->randomFloat(2, 50, 500),
            'tip_amount' => 0,
            'status' => 'initiated',
        ];
    }
}
