<?php

namespace Database\Seeders;

use App\Enums\Role;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class DatabaseSeeder extends Seeder
{
    /**
     * Seed baseline data: SaaS plans + the platform superadmin.
     * Tenant data is created through self-service onboarding, not seeded.
     */
    public function run(): void
    {
        $this->call(PlanSeeder::class);

        User::withoutTenancy()->updateOrCreate(
            ['email' => env('SUPERADMIN_EMAIL', 'superadmin@comiqr.com')],
            [
                'tenant_id' => null,
                'name' => 'Super Admin',
                'password' => Hash::make(env('SUPERADMIN_PASSWORD', 'password')),
                'role' => Role::Superadmin,
                'email_verified_at' => now(),
            ],
        );
    }
}
