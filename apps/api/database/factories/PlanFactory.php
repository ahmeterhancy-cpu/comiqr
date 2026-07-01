<?php

namespace Database\Factories;

use App\Models\Plan;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/**
 * @extends Factory<Plan>
 */
class PlanFactory extends Factory
{
    public function definition(): array
    {
        $name = fake()->unique()->word();

        return [
            'code' => Str::slug($name),
            'name' => ucfirst($name),
            'price_monthly' => fake()->randomFloat(2, 0, 199),
            'price_yearly' => fake()->randomFloat(2, 0, 1999),
            'currency' => 'EUR',
            'limits_json' => ['branches' => 1, 'ai_credits' => 0],
            'features_json' => [],
            'sort' => 0,
            'is_active' => true,
        ];
    }
}
