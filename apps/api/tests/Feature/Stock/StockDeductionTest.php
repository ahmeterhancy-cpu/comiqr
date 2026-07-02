<?php

use App\Enums\Role;
use App\Models\Branch;
use App\Models\Category;
use App\Models\Ingredient;
use App\Models\Plan;
use App\Models\Product;
use App\Models\Recipe;
use App\Models\StockMovement;
use App\Models\Table;
use App\Models\Tenant;
use App\Models\User;
use App\Support\Tenancy\TenantManager;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;

use function Pest\Laravel\getJson;
use function Pest\Laravel\postJson;

uses(RefreshDatabase::class);

beforeEach(fn () => $this->seed(Database\Seeders\PlanSeeder::class));

function stockedVenue(): array
{
    $tenant = Tenant::factory()->create(['plan_id' => Plan::firstWhere('code', 'pro')->id]);

    return app(TenantManager::class)->runAs($tenant, function () use ($tenant) {
        $branch = Branch::factory()->create();
        $category = Category::factory()->create();
        $product = Product::factory()->forCategory($category)->create(['price' => 100]);
        $ingredient = Ingredient::factory()->create([
            'name' => 'Hellim', 'unit' => 'g', 'stock_qty' => 1000, 'low_stock_threshold' => 200,
        ]);
        $recipe = Recipe::factory()->forProduct($product)->create(['yield_portions' => 1]);
        $recipe->items()->create(['ingredient_id' => $ingredient->id, 'quantity' => 150, 'unit' => 'g']);
        $table = Table::factory()->forBranch($branch)->create();

        return compact('tenant', 'ingredient', 'product', 'table');
    });
}

it('deducts ingredient stock through the recipe when an order is placed', function () {
    ['tenant' => $tenant, 'ingredient' => $ingredient, 'product' => $product, 'table' => $table] = stockedVenue();

    // qty 2 × 150 g = 300 g → 1000 - 300 = 700.
    postJson("/v1/sessions/{$table->qr_token}/orders", [
        'items' => [['product_id' => $product->id, 'quantity' => 2]],
    ])->assertCreated();

    expect($ingredient->fresh()->stock_qty)->toBe(700.0);

    $movements = StockMovement::withoutTenancy()->where('ingredient_id', $ingredient->id)->get();
    expect($movements)->toHaveCount(1)
        ->and((float) $movements->first()->qty_delta)->toBe(-300.0)
        ->and($movements->first()->reason)->toBe('order');
});

it('surfaces low stock and lets staff restock', function () {
    ['tenant' => $tenant, 'ingredient' => $ingredient, 'product' => $product, 'table' => $table] = stockedVenue();

    // qty 6 × 150 = 900 → 100, below threshold 200.
    postJson("/v1/sessions/{$table->qr_token}/orders", [
        'items' => [['product_id' => $product->id, 'quantity' => 6]],
    ])->assertCreated();

    Sanctum::actingAs(User::factory()->forTenant($tenant)->role(Role::Manager)->create());

    getJson('/v1/admin/inventory/low-stock')
        ->assertOk()
        ->assertJsonPath('data.0.id', $ingredient->id);

    postJson('/v1/admin/stock-movements', [
        'ingredient_id' => $ingredient->id, 'qty_delta' => 500, 'reason' => 'restock',
    ])->assertCreated()->assertJsonPath('data.stock_qty', 600);

    getJson('/v1/admin/inventory/low-stock')->assertOk()->assertJsonCount(0, 'data');
});
