<?php

namespace Database\Seeders;

use App\Enums\Role;
use App\Jobs\RecomputeNutrition;
use App\Models\Allergen;
use App\Models\Category;
use App\Models\Ingredient;
use App\Models\Plan;
use App\Models\Product;
use App\Models\Recipe;
use App\Models\Tenant;
use App\Models\User;
use App\Support\Tenancy\TenantManager;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

/**
 * A realistic TRNC demo venue with a menu, recipes and computed nutrition, so
 * the public menu + nutrition engine can be seen end-to-end. Idempotent.
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

            $a = fn (string $code) => Allergen::firstWhere('code', $code)?->id;

            // --- Ingredients (per 100 g/ml) ---
            $hellim = $this->ingredient('Hellim', ['kcal' => 320, 'protein_g' => 21, 'fat_g' => 25, 'saturated_fat_g' => 16, 'sodium_mg' => 700, 'unit_cost' => 220, 'is_vegetarian' => true, 'is_gluten_free' => true], [$a('milk') => false]);
            $kiyma = $this->ingredient('Dana Kıyma', ['kcal' => 250, 'protein_g' => 26, 'fat_g' => 15, 'saturated_fat_g' => 6, 'sodium_mg' => 75, 'unit_cost' => 320], []);
            $bulgur = $this->ingredient('Bulgur', ['kcal' => 342, 'protein_g' => 12, 'carb_g' => 76, 'fiber_g' => 18, 'unit_cost' => 40, 'is_vegan' => true, 'is_vegetarian' => true], [$a('gluten') => false]);
            $zeytin = $this->ingredient('Zeytinyağı', ['unit' => 'ml', 'kcal' => 884, 'fat_g' => 100, 'saturated_fat_g' => 14, 'unit_cost' => 180, 'cost_unit' => 'l', 'is_vegan' => true, 'is_vegetarian' => true, 'is_gluten_free' => true], []);
            $ekmek = $this->ingredient('Ekmek', ['kcal' => 265, 'protein_g' => 9, 'carb_g' => 49, 'fiber_g' => 3, 'unit_cost' => 30, 'is_vegan' => true, 'is_vegetarian' => true], [$a('gluten') => false]);
            $ceviz = $this->ingredient('Ceviz', ['kcal' => 654, 'protein_g' => 15, 'fat_g' => 65, 'fiber_g' => 7, 'unit_cost' => 400, 'is_vegan' => true, 'is_vegetarian' => true, 'is_gluten_free' => true], [$a('nuts') => false]);
            $baklavaHamur = $this->ingredient('Baklava Hamuru', ['kcal' => 310, 'protein_g' => 8, 'carb_g' => 55, 'unit_cost' => 90, 'is_vegetarian' => true], [$a('gluten') => false, $a('eggs') => true]);

            // --- Categories ---
            $mezeler = $this->category('Mezeler', 1);
            $anaYemek = $this->category('Ana Yemekler', 2);
            $tatlilar = $this->category('Tatlılar', 3);

            // --- Products + recipes ---
            $this->product($mezeler, 'Hellim Izgara', 140, ['tags_json' => ['favorite']], [
                [$hellim, 150, 'g'], [$zeytin, 10, 'ml'],
            ]);

            $this->product($anaYemek, 'Şeftali Kebabı', 280, ['tags_json' => ['chefs_choice']], [
                [$kiyma, 220, 'g'], [$bulgur, 120, 'g'], [$ekmek, 60, 'g'],
            ]);

            $this->product($tatlilar, 'Cevizli Baklava', 120, ['tags_json' => ['new']], [
                [$baklavaHamur, 90, 'g'], [$ceviz, 40, 'g'],
            ]);

            // Recompute nutrition for every product with a recipe.
            Product::whereHas('recipe')->pluck('id')
                ->each(fn ($id) => RecomputeNutrition::dispatch($tenant->id, $id));
        });
    }

    private function ingredient(string $name, array $attrs, array $allergens): Ingredient
    {
        $ingredient = Ingredient::updateOrCreate(
            ['name' => $name],
            array_merge(['unit' => 'g', 'cost_unit' => 'kg', 'waste_pct' => 5, 'data_source' => 'manual'], $attrs),
        );

        $sync = [];
        foreach ($allergens as $id => $trace) {
            if ($id) {
                $sync[$id] = ['trace' => $trace];
            }
        }
        $ingredient->allergens()->sync($sync);

        return $ingredient;
    }

    private function category(string $name, int $sort): Category
    {
        return Category::updateOrCreate(['name' => $name], ['sort' => $sort, 'is_active' => true]);
    }

    /** @param array<int,array{0:Ingredient,1:float,2:string}> $items */
    private function product(Category $category, string $name, float $price, array $extra, array $items): void
    {
        $product = Product::updateOrCreate(
            ['category_id' => $category->id, 'name' => $name],
            array_merge(['price' => $price, 'is_active' => true, 'calories_display' => true], $extra),
        );

        $recipe = Recipe::updateOrCreate(['product_id' => $product->id], ['yield_portions' => 1]);
        $recipe->items()->delete();
        foreach ($items as [$ingredient, $qty, $unit]) {
            $recipe->items()->create(['ingredient_id' => $ingredient->id, 'quantity' => $qty, 'unit' => $unit]);
        }
    }
}
