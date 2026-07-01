<?php

namespace Database\Factories;

use App\Models\Tenant;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/**
 * @extends Factory<Tenant>
 */
class TenantFactory extends Factory
{
    public function definition(): array
    {
        $name = fake()->unique()->company();

        return [
            'name' => $name,
            'slug' => Str::slug($name).'-'.fake()->unique()->numberBetween(1000, 9999),
            'custom_domain' => null,
            'plan_id' => null,
            'status' => 'active',
            'locale_default' => 'tr',
            'currency' => 'EUR',
            'timezone' => 'Asia/Nicosia',
            'settings_json' => null,
        ];
    }

    public function suspended(): static
    {
        return $this->state(fn () => ['status' => 'suspended']);
    }

    public function slug(string $slug): static
    {
        return $this->state(fn () => ['slug' => $slug]);
    }
}
