<?php

namespace Database\Seeders;

use App\Enums\Role;
use App\Models\Branch;
use App\Models\Category;
use App\Models\DiningArea;
use App\Models\NutritionSummary;
use App\Models\Plan;
use App\Models\Product;
use App\Models\Table;
use App\Models\Tenant;
use App\Models\User;
use App\Support\Tenancy\TenantManager;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

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
                'plan_id' => Plan::firstWhere('code', 'enterprise')?->id,
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
                // White-label demo (Enterprise): custom brand colour + no "Powered by".
                'brand_color' => '#7c3aed',
                'hide_powered_by' => true,
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

            // [name, price, emoji, description, kcal, ageRestricted]
            $menu = [
                'Kokteyller' => [
                    ['Mojito', 190, '🍹', 'Beyaz rom, taze nane, misket limonu ve soda.', 180, true],
                    ['Gin Tonik', 180, '🍸', 'London dry gin, tonik ve salatalık.', 170, true],
                    ['Margarita', 200, '🍹', 'Tekila, triple sec, limon; tuzlu kenar.', 200, true],
                    ['Negroni', 210, '🥃', 'Gin, campari ve kırmızı vermut.', 240, true],
                    ['Aperol Spritz', 190, '🥂', 'Aperol, prosecco ve soda.', 160, true],
                ],
                'Bira & Şarap' => [
                    ['Efes (33cl)', 60, '🍺', 'Soğuk Efes Pilsen.', 140, true],
                    ['Corona (33cl)', 90, '🍺', 'Meksika birası, limon ile.', 150, true],
                    ['Kırmızı Şarap (kadeh)', 120, '🍷', 'Yerli kırmızı şarap.', 130, true],
                    ['Beyaz Şarap (kadeh)', 120, '🥂', 'Soğuk yerli beyaz şarap.', 120, true],
                    ['Rakı (tek)', 150, '🥃', 'Yeni Rakı, su ve buz ile.', 130, true],
                ],
                'Alkolsüz' => [
                    ['Kola', 40, '🥤', 'Soğuk kutu kola.', 140, false],
                    ['Ev Yapımı Limonata', 45, '🍋', 'Taze naneli limonata.', 90, false],
                    ['Soda', 30, '💧', 'Sade veya limonlu soda.', 5, false],
                    ['Su', 25, '💧', '0.5L doğal kaynak suyu.', 0, false],
                ],
                'Atıştırmalık' => [
                    ['Peynir Tabağı', 160, '🧀', 'Yerli peynirler, ceviz ve üzüm.', 420, false],
                    ['Patates Kızartması', 80, '🍟', 'Çıtır patates, ketçap ve mayonez.', 380, false],
                    ['Karışık Kuruyemiş', 70, '🥜', 'Bar ikramı karışık kuruyemiş.', 320, false],
                ],
            ];

            $sort = 1;
            foreach ($menu as $catName => $items) {
                $c = Category::updateOrCreate(['tenant_id' => $tenant->id, 'name' => $catName], ['sort' => $sort++, 'is_active' => true]);
                foreach ($items as $d) {
                    $this->dish($c, $d[0], $d[1], $d[2], $d[3], $d[4], $d[5]);
                }
            }
        });
    }

    private function dish(Category $cat, string $name, float $price, string $emoji, string $desc, int $kcal, bool $age): Product
    {
        $product = Product::updateOrCreate(
            ['category_id' => $cat->id, 'name' => $name],
            [
                'price' => $price,
                'description' => $desc,
                'is_active' => true,
                'age_restricted' => $age,
                'calories_display' => $kcal > 0,
                'image_paths_json' => [$this->emojiImg('demo-bar/'.Str::slug($name).'.svg', $emoji, '#eef1f6')],
            ],
        );

        NutritionSummary::updateOrCreate(['product_id' => $product->id], [
            'per_portion_kcal' => $kcal,
            'protein_g' => max(0, round($kcal * 0.02)),
            'carb_g' => max(1, round($kcal * 0.09)),
            'fat_g' => max(0, round($kcal * 0.03)),
            'saturated_fat_g' => max(0, round($kcal * 0.01)),
            'sugar_g' => 6,
            'fiber_g' => 1,
            'sodium_mg' => 200,
            'allergen_ids_json' => ['contains' => [], 'traces' => []],
            'diet_flags_json' => ['vegan' => false, 'vegetarian' => true, 'gluten_free' => false],
            'is_stale' => false,
            'computed_at' => now(),
        ]);

        return $product;
    }

    /** A clean emoji-on-tint square, served from the public disk. */
    private function emojiImg(string $path, string $emoji, string $bg, int $w = 400): string
    {
        $size = (int) ($w * 0.5);
        $svg = '<svg xmlns="http://www.w3.org/2000/svg" width="'.$w.'" height="'.$w.'" viewBox="0 0 '.$w.' '.$w.'">'
            .'<rect width="100%" height="100%" fill="'.$bg.'"/>'
            .'<text x="50%" y="50%" font-size="'.$size.'" text-anchor="middle" dominant-baseline="central">'.$emoji.'</text></svg>';

        Storage::disk('public')->put($path, $svg);

        return url('/v1/media/'.$path);
    }
}
