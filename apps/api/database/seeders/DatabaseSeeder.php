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
        $this->call(AllergenSeeder::class);

        /*
         * Degerler config'ten okunur, env()'den DEGIL: `config:cache` sonrasi
         * Laravel .env'i yuklemez ve buradaki env() null doner -- parola
         * sessizce varsayilana duserdi.
         */
        $password = config('platform.superadmin.password')
            ?? (app()->environment('production') ? null : 'password');

        abort_if(
            $password === null,
            500,
            'SUPERADMIN_PASSWORD tanimli degil. Uretimde superadmin parolasi acikca verilmelidir.',
        );

        User::withoutTenancy()->updateOrCreate(
            ['email' => config('platform.superadmin.email')],
            [
                'tenant_id' => null,
                'name' => 'Super Admin',
                'password' => Hash::make($password),
                'role' => Role::Superadmin,
                'email_verified_at' => now(),
            ],
        );
    }
}
