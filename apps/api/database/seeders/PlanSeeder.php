<?php

namespace Database\Seeders;

use App\Models\Plan;
use Illuminate\Database\Seeder;

/**
 * The four SaaS tiers (docs/01 §1.6). Limits use -1 for "unlimited".
 * Feature flags gate modules per plan (enforced later by plan/limit middleware).
 */
class PlanSeeder extends Seeder
{
    public function run(): void
    {
        $plans = [
            [
                'code' => 'free',
                'name' => 'Free',
                'price_monthly' => 0,
                'price_yearly' => 0,
                'sort' => 1,
                'limits_json' => ['branches' => 1, 'menu_items' => 30, 'monthly_scans' => 500, 'ai_credits' => 0],
                'features_json' => [
                    'menu' => true, 'qr' => true, 'nutrition_display' => true,
                    'ordering' => false, 'payments' => false, 'kds' => false,
                    'analytics' => false, 'ai' => false,
                    'verticals' => ['restaurant'],
                ],
            ],
            [
                'code' => 'pro',
                'name' => 'Pro',
                'price_monthly' => 29,
                'price_yearly' => 290,
                'sort' => 2,
                'limits_json' => ['branches' => 1, 'menu_items' => -1, 'monthly_scans' => 10000, 'ai_credits' => 100],
                'features_json' => [
                    'menu' => true, 'qr' => true, 'nutrition_display' => true, 'nutrition_full' => true,
                    'ordering' => true, 'payments' => true, 'kds' => true, 'waiter_app' => true,
                    'analytics' => true, 'ai' => true,
                    'happy_hour' => true,
                    'verticals' => ['restaurant', 'bar'],
                ],
            ],
            [
                'code' => 'business',
                'name' => 'Business',
                'price_monthly' => 79,
                'price_yearly' => 790,
                'sort' => 3,
                'limits_json' => ['branches' => 5, 'menu_items' => -1, 'monthly_scans' => 50000, 'ai_credits' => 500],
                'features_json' => [
                    'menu' => true, 'qr' => true, 'nutrition_display' => true, 'nutrition_full' => true,
                    'ordering' => true, 'payments' => true, 'kds' => true, 'waiter_app' => true,
                    'analytics' => true, 'ai' => true, 'ai_advanced' => true,
                    'pos_integration' => true, 'loyalty' => true, 'multi_branch' => true,
                    'happy_hour' => true, 'folio' => true,
                    'verticals' => ['restaurant', 'bar', 'hotel', 'beach'],
                ],
            ],
            [
                'code' => 'enterprise',
                'name' => 'Enterprise',
                'price_monthly' => 0, // custom / contact sales
                'price_yearly' => 0,
                'sort' => 4,
                'limits_json' => ['branches' => -1, 'menu_items' => -1, 'monthly_scans' => -1, 'ai_credits' => -1],
                'features_json' => [
                    'menu' => true, 'qr' => true, 'nutrition_display' => true, 'nutrition_full' => true,
                    'ordering' => true, 'payments' => true, 'kds' => true, 'waiter_app' => true,
                    'analytics' => true, 'ai' => true, 'ai_advanced' => true,
                    'pos_integration' => true, 'loyalty' => true, 'multi_branch' => true,
                    'white_label' => true, 'custom_integration' => true, 'sla' => true,
                    'happy_hour' => true, 'folio' => true,
                    'verticals' => ['restaurant', 'bar', 'hotel', 'beach'],
                ],
            ],
        ];

        foreach ($plans as $plan) {
            Plan::updateOrCreate(['code' => $plan['code']], $plan + ['currency' => 'TRY', 'is_active' => true]);
        }
    }
}
