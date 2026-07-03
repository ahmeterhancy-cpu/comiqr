<?php

namespace Database\Seeders;

use App\Enums\Role;
use App\Models\Branch;
use App\Models\Category;
use App\Models\DiningArea;
use App\Models\Plan;
use App\Models\Product;
use App\Models\Table;
use App\Models\Tenant;
use App\Models\User;
use App\Support\Tenancy\TenantManager;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

/**
 * A demo BAR venue (Faz 3 vertical) so the 18+ age gate and happy-hour discount
 * can be seen end-to-end. Happy hour is set all-day for the demo so the banner
 * and discount are always visible. Idempotent.
 * Owner login: bar@comiqr.com / password · subdomain: demo-bar
 */
class DemoBarSeeder extends Seeder
{
    public function run(): void
    {
        $this->call([PlanSeeder::class]);

        $tenant = Tenant::firstOrCreate(
            ['slug' => 'demo-bar'],
            [
                'name' => 'Efsane Bar',
                'plan_id' => Plan::firstWhere('code', 'pro')?->id,
                'status' => 'active',
                'locale_default' => 'tr',
                'currency' => 'TRY',
                'timezone' => 'Asia/Nicosia',
            ],
        );

        app(TenantManager::class)->runAs($tenant, function () use ($tenant) {
            User::firstOrCreate(
                ['email' => 'bar@comiqr.com'],
                [
                    'tenant_id' => $tenant->id,
                    'name' => 'Bar Yönetimi',
                    'password' => Hash::make('password'),
                    'role' => Role::Owner,
                    'email_verified_at' => now(),
                ],
            );

            $tenant->update(['settings_json' => array_merge($tenant->settings_json ?? [], [
                'vertical' => 'bar',
                'theme' => 'modern',
                'sub_title' => 'Cocktail & Bar',
                'timing' => '17:00 - 02:00',
                'description' => 'Canlı müzik, imza kokteyller ve geniş içki menüsü.',
                'address' => 'Liman Cad. No:7, Girne / KKTC',
                // All-day window for the demo → banner + discount always visible.
                'happy_hour' => ['enabled' => true, 'start' => '00:00', 'end' => '23:59', 'percent' => 20],
            ])]);

            $branch = Branch::firstOrCreate(
                ['tenant_id' => $tenant->id, 'name' => 'Merkez'],
                ['is_active' => true, 'timezone' => 'Asia/Nicosia'],
            );

            $area = DiningArea::firstOrCreate(
                ['tenant_id' => $tenant->id, 'branch_id' => $branch->id, 'name' => 'Bar'],
                ['type' => 'table'],
            );

            collect(['B1', 'B2', 'B3'])->each(fn ($code) => Table::firstOrCreate(
                ['tenant_id' => $tenant->id, 'branch_id' => $branch->id, 'dining_area_id' => $area->id, 'code' => $code],
                ['is_active' => true],
            ));

            $drinks = Category::updateOrCreate(
                ['tenant_id' => $tenant->id, 'name' => 'İçecekler'],
                ['sort' => 1, 'is_active' => true],
            );
            $soft = Category::updateOrCreate(
                ['tenant_id' => $tenant->id, 'name' => 'Alkolsüz'],
                ['sort' => 2, 'is_active' => true],
            );

            $this->product($drinks, 'Efes (33cl)', 60, true);
            $this->product($drinks, 'Kırmızı Şarap (kadeh)', 120, true);
            $this->product($drinks, 'Rakı (tek)', 150, true);
            $this->product($drinks, 'Gin Tonik', 180, true);
            $this->product($soft, 'Kola', 40, false);
            $this->product($soft, 'Ev Yapımı Limonata', 45, false);
        });
    }

    private function product(Category $category, string $name, float $price, bool $ageRestricted): Product
    {
        return Product::updateOrCreate(
            ['category_id' => $category->id, 'name' => $name],
            ['price' => $price, 'is_active' => true, 'calories_display' => false, 'age_restricted' => $ageRestricted],
        );
    }
}
