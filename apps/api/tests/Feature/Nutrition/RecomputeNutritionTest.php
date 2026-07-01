<?php

use App\Jobs\RecomputeNutrition;
use App\Models\Allergen;
use App\Models\Ingredient;
use App\Models\NutritionSummary;
use App\Models\Product;
use App\Models\Recipe;
use App\Models\RecipeItem;
use App\Models\Tenant;
use App\Support\Tenancy\TenantManager;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

beforeEach(function () {
    $this->seed(Database\Seeders\AllergenSeeder::class);
    $this->tenants = app(TenantManager::class);
});

it('computes and stores a nutrition summary from a recipe', function () {
    $tenant = Tenant::factory()->create();
    $milk = Allergen::firstWhere('code', 'milk');

    [$product] = $this->tenants->runAs($tenant, function () use ($milk) {
        $product = Product::factory()->create(['price' => 30]);

        $ingredient = Ingredient::factory()->create([
            'name' => 'Hellim',
            'unit' => 'g',
            'kcal' => 200, 'protein_g' => 10, 'carb_g' => 20, 'fat_g' => 8,
            'saturated_fat_g' => 3, 'sugar_g' => 5, 'fiber_g' => 2, 'sodium_mg' => 400,
            'unit_cost' => 50, 'cost_unit' => 'kg', 'waste_pct' => 0,
            'is_vegan' => false, 'is_vegetarian' => true, 'is_gluten_free' => true,
        ]);
        $ingredient->allergens()->attach($milk->id, ['trace' => false]);

        $recipe = Recipe::factory()->forProduct($product)->create(['yield_portions' => 2]);
        RecipeItem::create([
            'recipe_id' => $recipe->id,
            'ingredient_id' => $ingredient->id,
            'quantity' => 300,
            'unit' => 'g',
        ]);

        return [$product];
    });

    RecomputeNutrition::dispatchSync($tenant->id, $product->id);

    $summary = $this->tenants->runAs($tenant, fn () => NutritionSummary::firstWhere('product_id', $product->id));

    expect($summary)->not->toBeNull()
        ->and($summary->per_portion_kcal)->toBe(300.0)
        ->and($summary->protein_g)->toBe(15.0)
        ->and($summary->cost_per_portion)->toBe(7.5)
        ->and($summary->suggested_price)->toBe(25.0)
        ->and($summary->margin_pct)->toBe(75.0)
        ->and($summary->is_stale)->toBeFalse()
        ->and($summary->diet_flags_json['vegan'])->toBeFalse()
        ->and($summary->diet_flags_json['gluten_free'])->toBeTrue()
        ->and($summary->allergen_ids_json['contains'])->toBe([$milk->id]);
});

it('removes the summary when the recipe has no items', function () {
    $tenant = Tenant::factory()->create();

    $product = $this->tenants->runAs($tenant, function () {
        $product = Product::factory()->create(['price' => 20]);
        NutritionSummary::create(['product_id' => $product->id, 'per_portion_kcal' => 999, 'is_stale' => true]);
        Recipe::factory()->forProduct($product)->create(); // no items

        return $product;
    });

    RecomputeNutrition::dispatchSync($tenant->id, $product->id);

    $exists = $this->tenants->runAs($tenant, fn () => NutritionSummary::where('product_id', $product->id)->exists());
    expect($exists)->toBeFalse();
});
