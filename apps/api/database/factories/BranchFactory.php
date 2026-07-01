<?php

namespace Database\Factories;

use App\Models\Branch;
use App\Models\Tenant;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Branch>
 */
class BranchFactory extends Factory
{
    public function definition(): array
    {
        return [
            'tenant_id' => Tenant::factory(),
            'name' => fake()->company().' '.fake()->city(),
            'address' => fake()->address(),
            'phone' => fake()->e164PhoneNumber(),
            'lat' => fake()->latitude(35.1, 35.4),   // TRNC bounding box-ish
            'lng' => fake()->longitude(33.2, 34.6),
            'timezone' => 'Asia/Nicosia',
            'is_active' => true,
            'settings_json' => null,
        ];
    }
}
