<?php

namespace Database\Seeders;

use App\Enums\Role;
use App\Models\Allergen;
use App\Models\Branch;
use App\Models\Category;
use App\Models\ModifierGroup;
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
 * A realistic, full TRNC meze/kebab restaurant so the QR menu looks like a real
 * venue: 6 categories, ~26 dishes with appetising descriptions, prices, calories
 * and emoji imagery. Idempotent.
 * Owner login: demo@comiqr.com / password · subdomain: demo
 */
class DemoMenuSeeder extends Seeder
{
    public function run(): void
    {
        $this->call([PlanSeeder::class, AllergenSeeder::class]);

        $tenant = Tenant::firstOrCreate(
            ['slug' => 'demo'],
            [
                'name' => 'Girne Meze Bahçesi',
                'plan_id' => Plan::firstWhere('code', 'pro')?->id,
                'status' => 'active',
                'locale_default' => 'tr',
                'currency' => 'TRY',
                'timezone' => 'Asia/Nicosia',
            ],
        );

        app(TenantManager::class)->runAs($tenant, function () use ($tenant) {
            User::firstOrCreate(
                ['email' => 'demo@comiqr.com'],
                [
                    'tenant_id' => $tenant->id,
                    'name' => 'Demo Sahibi',
                    'password' => Hash::make('password'),
                    'role' => Role::Owner,
                    'email_verified_at' => now(),
                ],
            );

            $tenant->update(['settings_json' => array_merge($tenant->settings_json ?? [], [
                'logo' => $this->emojiImg('demo/logo.svg', '🌿', '#0f766e', 240),
                'cover' => $this->emojiImg('demo/cover.svg', '🍢', '#14284a', 1200, 480),
                'sub_title' => 'Girne Meze & Mangal',
                'timing' => '11:00 - 23:00',
                'description' => "Kıbrıs'ın en taze mezeleri, mangalda hellim ve közde şeftali kebabı. Deniz manzarasında keyifli bir sofra sizi bekliyor.",
                'address' => 'Sahil Yolu No:12, Girne / KKTC',
            ])]);

            $branch = Branch::firstOrCreate(['tenant_id' => $tenant->id, 'name' => 'Merkez'], ['is_active' => true, 'timezone' => 'Asia/Nicosia']);
            foreach (['Masa 1', 'Masa 2', 'Masa 3', 'Masa 4', 'Bahçe 1', 'Bahçe 2'] as $code) {
                Table::firstOrCreate(['tenant_id' => $tenant->id, 'branch_id' => $branch->id, 'code' => $code], ['is_active' => true]);
            }

            // [category, name, price, emoji, description, kcal, diet, allergens]
            $menu = [
                'Mezeler' => [
                    ['Hellim Izgara', 140, '🧀', 'Kıbrıs’ın meşhur hellimi közde altın rengi kızartıldı, taze nane ile.', 320, ['vegetarian', 'gluten_free'], ['milk']],
                    ['Humus', 90, '🥣', 'Nohut püresi, tahin, zeytinyağı ve kimyon; sıcak pide ile.', 280, ['vegan', 'gluten_free'], []],
                    ['Cacık', 70, '🥒', 'Süzme yoğurt, salatalık, sarımsak ve nane.', 120, ['vegetarian', 'gluten_free'], ['milk']],
                    ['Şakşuka', 95, '🍆', 'Kızarmış patlıcan, biber ve domates sos.', 210, ['vegan', 'gluten_free'], []],
                    ['Girit Ezme', 85, '🫒', 'Beyaz peynir, ceviz ve zeytinyağı ezmesi.', 240, ['vegetarian'], ['milk', 'nuts']],
                    ['Sigara Böreği', 100, '🥟', 'Peynirli çıtır yufka böreği (5 adet).', 350, ['vegetarian'], ['gluten', 'milk']],
                ],
                'Ana Yemekler' => [
                    ['Şeftali Kebabı', 280, '🍢', 'Közde kuzu kıyma kebabı, közlenmiş biber ve bulgur pilavı ile.', 620, [], ['gluten']],
                    ['Adana Kebap', 260, '🌶️', 'Acılı el yapımı zırh kıyma kebabı, közlenmiş domates ile.', 580, [], ['gluten']],
                    ['Izgara Köfte', 220, '🍖', 'Baharatlı ızgara köfte, pilav ve közlenmiş sebze.', 540, [], ['gluten']],
                    ['Kuzu Şiş', 320, '🍢', 'Marine kuzu şiş, mangalda; közlenmiş sebze ile.', 560, ['gluten_free'], []],
                    ['Tavuk Şiş', 240, '🍗', 'Marine tavuk göğsü şiş, ızgara.', 480, ['gluten_free'], []],
                    ['Fırın Kolokas', 260, '🥘', 'Kıbrıs usulü kolokas, kuzu etiyle fırında.', 610, [], []],
                ],
                'Deniz Ürünleri' => [
                    ['Izgara Çipura', 340, '🐟', 'Taze çipura ızgarada, limon ve roka ile.', 420, ['gluten_free'], ['fish']],
                    ['Kalamar Tava', 280, '🦑', 'Çıtır kalamar halkaları, tartar sos ile.', 460, [], ['gluten', 'eggs']],
                    ['Karides Güveç', 360, '🦐', 'Domates soslu güveçte karides, kaşar ile.', 490, ['gluten_free'], ['milk']],
                ],
                'Salatalar' => [
                    ['Çoban Salata', 80, '🥗', 'Domates, salatalık, biber, soğan ve maydanoz.', 90, ['vegan', 'gluten_free'], []],
                    ['Akdeniz Salatası', 110, '🥗', 'Roka, beyaz peynir, ceviz, nar ekşili sos.', 260, ['vegetarian', 'gluten_free'], ['milk', 'nuts']],
                ],
                'Tatlılar' => [
                    ['Cevizli Baklava', 120, '🍯', 'El açması yufka, ceviz ve hafif şerbet.', 480, ['vegetarian'], ['gluten', 'nuts']],
                    ['Ekmek Kadayıfı', 110, '🍮', 'Şerbetli kadayıf, bol kaymak ile.', 520, ['vegetarian'], ['gluten', 'milk']],
                    ['Fırın Sütlaç', 80, '🍚', 'Fırında Kıbrıs sütlacı, tarçınlı.', 300, ['vegetarian', 'gluten_free'], ['milk']],
                    ['Sakızlı Dondurma', 90, '🍨', 'Maraş usulü sakızlı dondurma (3 top).', 350, ['vegetarian', 'gluten_free'], ['milk']],
                ],
                'İçecekler' => [
                    ['Ayran', 40, '🥛', 'Ev yapımı köpüklü ayran.', 90, ['vegetarian', 'gluten_free'], ['milk']],
                    ['Taze Portakal Suyu', 70, '🍊', 'Günlük sıkma portakal suyu.', 120, ['vegan', 'gluten_free'], []],
                    ['Türk Kahvesi', 60, '☕', 'Közde pişmiş Türk kahvesi, lokum ile.', 20, ['vegan', 'gluten_free'], []],
                    ['Kıbrıs Çayı', 25, '🫖', 'Demli ince belli çay.', 5, ['vegan', 'gluten_free'], []],
                ],
            ];

            $products = [];
            $sort = 1;
            foreach ($menu as $catName => $dishes) {
                $cat = Category::updateOrCreate(['tenant_id' => $tenant->id, 'name' => $catName], ['sort' => $sort++, 'is_active' => true]);
                foreach ($dishes as $d) {
                    $products[$d[0]] = $this->dish($cat, $d[0], $d[1], $d[2], $d[3], $d[4], $d[5], $d[6]);
                }
            }

            // Modifier groups (M1) — a few real add-on / choice sets.
            $extras = $this->modifierGroup('Ekstra Malzeme', ['min_select' => 0, 'max_select' => 3, 'is_required' => false], [
                ['name' => 'Ekstra Hellim', 'price_delta' => 40],
                ['name' => 'Acılı Sos', 'price_delta' => 0],
                ['name' => 'Ceviz', 'price_delta' => 25],
            ]);
            $products['Hellim Izgara']->modifierGroups()->syncWithoutDetaching([$extras->id]);
            $products['Girit Ezme']->modifierGroups()->syncWithoutDetaching([$extras->id]);

            $doneness = $this->modifierGroup('Pişme Derecesi', ['min_select' => 1, 'max_select' => 1, 'is_required' => true], [
                ['name' => 'Az Pişmiş', 'price_delta' => 0],
                ['name' => 'Orta', 'price_delta' => 0],
                ['name' => 'İyi Pişmiş', 'price_delta' => 0],
            ]);
            foreach (['Şeftali Kebabı', 'Adana Kebap', 'Kuzu Şiş', 'Izgara Köfte'] as $name) {
                $products[$name]->modifierGroups()->syncWithoutDetaching([$doneness->id]);
            }
        });
    }

    /** Create a dish with description, emoji image and a ready nutrition summary. */
    private function dish(Category $cat, string $name, float $price, string $emoji, string $desc, int $kcal, array $diet, array $allergens): Product
    {
        $product = Product::updateOrCreate(
            ['category_id' => $cat->id, 'name' => $name],
            [
                'price' => $price,
                'description' => $desc,
                'is_active' => true,
                'calories_display' => true,
                'image_paths_json' => [$this->emojiImg('demo/'.Str::slug($name).'.svg', $emoji, '#eef1f6')],
            ],
        );

        $vegan = in_array('vegan', $diet, true);
        $ids = array_values(array_filter(array_map(fn ($c) => Allergen::firstWhere('code', $c)?->id, $allergens)));

        NutritionSummary::updateOrCreate(
            ['product_id' => $product->id],
            [
                'per_portion_kcal' => $kcal,
                'protein_g' => max(1, round($kcal * 0.05)),
                'carb_g' => max(1, round($kcal * 0.10)),
                'fat_g' => max(1, round($kcal * 0.04)),
                'saturated_fat_g' => max(0, round($kcal * 0.015)),
                'sugar_g' => 4,
                'fiber_g' => 3,
                'sodium_mg' => 420,
                'allergen_ids_json' => ['contains' => $ids, 'traces' => []],
                'diet_flags_json' => [
                    'vegan' => $vegan,
                    'vegetarian' => $vegan || in_array('vegetarian', $diet, true),
                    'gluten_free' => in_array('gluten_free', $diet, true),
                ],
                'is_stale' => false,
                'computed_at' => now(),
            ],
        );

        return $product;
    }

    /**
     * @param  array{min_select:int,max_select:int,is_required:bool}  $attrs
     * @param  array<int,array{name:string,price_delta:float}>  $options
     */
    private function modifierGroup(string $name, array $attrs, array $options): ModifierGroup
    {
        $group = ModifierGroup::updateOrCreate(['name' => $name], $attrs);
        $group->modifiers()->delete();
        foreach ($options as $sort => $option) {
            $group->modifiers()->create($option + ['sort' => $sort]);
        }

        return $group;
    }

    /** A clean emoji-on-tint square, served from the public disk. */
    private function emojiImg(string $path, string $emoji, string $bg, int $w = 400, int $h = 0): string
    {
        $h = $h ?: $w;
        $size = (int) ($h * 0.5);
        $svg = '<svg xmlns="http://www.w3.org/2000/svg" width="'.$w.'" height="'.$h.'" viewBox="0 0 '.$w.' '.$h.'">'
            .'<rect width="100%" height="100%" fill="'.$bg.'"/>'
            .'<text x="50%" y="50%" font-size="'.$size.'" text-anchor="middle" dominant-baseline="central">'.$emoji.'</text></svg>';

        Storage::disk('public')->put($path, $svg);

        return url('/v1/media/'.$path);
    }
}
