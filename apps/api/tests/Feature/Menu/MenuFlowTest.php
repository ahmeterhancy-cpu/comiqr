<?php

use App\Enums\Role;
use App\Models\Allergen;
use App\Models\Tenant;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;

use function Pest\Laravel\getJson;
use function Pest\Laravel\postJson;
use function Pest\Laravel\putJson;

uses(RefreshDatabase::class);

beforeEach(function () {
    $this->seed(Database\Seeders\PlanSeeder::class);
    $this->seed(Database\Seeders\AllergenSeeder::class);
});

it('manages a menu and exposes it publicly with computed nutrition', function () {
    $tenant = Tenant::factory()->slug('demo-venue')->create();
    $owner = User::factory()->forTenant($tenant)->role(Role::Owner)->create();
    Sanctum::actingAs($owner);

    $categoryId = postJson('/v1/admin/categories', ['name' => 'Ana Yemekler'])
        ->assertCreated()->json('data.id');

    $productId = postJson('/v1/admin/products', [
        'category_id' => $categoryId,
        'name' => 'Hellim Izgara',
        'price' => 120,
    ])->assertCreated()->json('data.id');

    $milk = Allergen::firstWhere('code', 'milk');
    $ingredientId = postJson('/v1/admin/ingredients', [
        'name' => 'Hellim',
        'unit' => 'g',
        'kcal' => 320, 'protein_g' => 22, 'fat_g' => 25,
        'unit_cost' => 200, 'cost_unit' => 'kg',
        'is_vegetarian' => true, 'is_gluten_free' => true,
        'allergens' => [['id' => $milk->id, 'trace' => false]],
    ])->assertCreated()->json('data.id');

    // Saving the recipe recomputes nutrition (sync queue in tests).
    putJson("/v1/admin/products/{$productId}/recipe", [
        'yield_portions' => 1,
        'items' => [['ingredient_id' => $ingredientId, 'quantity' => 150, 'unit' => 'g']],
    ])->assertOk()->assertJsonPath('data.is_stale', true);

    // Owner nutrition view (150 g × 320/100 = 480 kcal; 0.15 kg × 200 = 30 cost).
    // Whole values serialize to JSON integers; assert as ints (strict compare).
    getJson("/v1/admin/products/{$productId}/nutrition")
        ->assertOk()
        ->assertJsonPath('data.kcal', 480)
        ->assertJsonPath('data.cost_per_portion', 30)
        ->assertJsonPath('data.margin_pct', 75);

    // Public menu shows the product with its cached nutrition (no cost leaked).
    getJson('/v1/menu', ['X-Tenant' => 'demo-venue'])
        ->assertOk()
        ->assertJsonPath('data.venue.name', $tenant->name)
        ->assertJsonPath('data.categories.0.products.0.name', 'Hellim Izgara')
        ->assertJsonPath('data.categories.0.products.0.nutrition.kcal', 480)
        ->assertJsonPath('data.categories.0.products.0.nutrition.diet.gluten_free', true)
        ->assertJsonMissingPath('data.categories.0.products.0.nutrition.cost_per_portion');
});

it('does not leak one tenant menu to another', function () {
    $a = Tenant::factory()->slug('venue-a')->create();
    $owner = User::factory()->forTenant($a)->role(Role::Owner)->create();
    Sanctum::actingAs($owner);

    $catId = postJson('/v1/admin/categories', ['name' => 'A Kategori'])->json('data.id');
    postJson('/v1/admin/products', ['category_id' => $catId, 'name' => 'A Ürün', 'price' => 50])->assertCreated();

    Tenant::factory()->slug('venue-b')->create();

    getJson('/v1/menu', ['X-Tenant' => 'venue-b'])
        ->assertOk()
        ->assertJsonCount(0, 'data.categories');
});

it('requires manager role to manage the menu', function () {
    $tenant = Tenant::factory()->create();
    $waiter = User::factory()->forTenant($tenant)->role(Role::Waiter)->create();
    Sanctum::actingAs($waiter);

    postJson('/v1/admin/categories', ['name' => 'Nope'])->assertForbidden();
});
