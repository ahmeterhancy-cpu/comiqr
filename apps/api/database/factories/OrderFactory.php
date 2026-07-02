<?php

namespace Database\Factories;

use App\Models\Branch;
use App\Models\Order;
use App\Models\Tenant;
use App\Support\Tenancy\TenantManager;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Order>
 */
class OrderFactory extends Factory
{
    public function definition(): array
    {
        $subtotal = fake()->randomFloat(2, 50, 500);

        return [
            'tenant_id' => app(TenantManager::class)->id() ?? Tenant::factory(),
            'branch_id' => Branch::factory(),
            'table_session_id' => null,
            'source' => 'qr',
            'status' => 'pending',
            'payment_status' => 'unpaid',
            'subtotal' => $subtotal,
            'grand_total' => $subtotal,
            'placed_at' => now(),
        ];
    }
}
