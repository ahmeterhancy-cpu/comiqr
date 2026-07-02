<?php

use App\Enums\Role;
use App\Models\Branch;
use App\Models\Category;
use App\Models\NutritionSummary;
use App\Models\Order;
use App\Models\Product;
use App\Models\Tenant;
use App\Models\User;
use App\Support\Tenancy\TenantManager;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;

use function Pest\Laravel\getJson;

uses(RefreshDatabase::class);

/** Product with a recipe cost and a given number of units sold in-range. */
function heatmapProduct(Category $category, string $name, float $price, float $cost, int $qty, Branch $branch): Product
{
    $product = Product::factory()->forCategory($category)->create(['name' => $name, 'price' => $price]);

    NutritionSummary::create([
        'product_id' => $product->id,
        'cost_per_portion' => $cost,
        'is_stale' => false,
        'computed_at' => now(),
    ]);

    if ($qty > 0) {
        $order = Order::factory()->create(['branch_id' => $branch->id, 'placed_at' => now()]);
        $order->items()->create([
            'product_id' => $product->id,
            'quantity' => $qty,
            'unit_price' => $price,
            'line_total' => $price * $qty,
            'status' => 'served',
        ]);
    }

    return $product;
}

it('classifies products into menu-engineering quadrants (median thresholds)', function () {
    $tenant = Tenant::factory()->create();

    app(TenantManager::class)->runAs($tenant, function () {
        $branch = Branch::factory()->create();
        $category = Category::factory()->create();

        // qty medyanı 4.5 → eşik max(1, 4.5); marj medyanı 80.
        heatmapProduct($category, 'Beygir', 100, 90, 10, $branch);  // popüler(10) + düşük marj(10) → plowhorse
        heatmapProduct($category, 'Yildiz', 200, 50, 8, $branch);   // popüler(8) + yüksek marj(150) → star
        heatmapProduct($category, 'Bilmece', 300, 60, 1, $branch);  // az(1) + yüksek marj(240) → puzzle
        heatmapProduct($category, 'Kopek', 50, 45, 0, $branch);     // az(0) + düşük marj(5) → dog
    });

    Sanctum::actingAs(User::factory()->forTenant($tenant)->role(Role::Manager)->create());

    $res = getJson('/v1/admin/analytics/heatmap')->assertOk();

    $res->assertJsonPath('data.quadrant_counts.star', 1)
        ->assertJsonPath('data.quadrant_counts.plowhorse', 1)
        ->assertJsonPath('data.quadrant_counts.puzzle', 1)
        ->assertJsonPath('data.quadrant_counts.dog', 1);

    $byName = collect($res->json('data.products'))->keyBy('name');
    expect($byName['Yildiz']['quadrant'])->toBe('star');
    expect($byName['Beygir']['quadrant'])->toBe('plowhorse');
    expect($byName['Bilmece']['quadrant'])->toBe('puzzle');
    expect($byName['Kopek']['quadrant'])->toBe('dog');

    // Unit margin = price − recipe cost (JSON encodes 150.0 as int 150).
    expect((float) $byName['Yildiz']['unit_margin'])->toBe(150.0);
    // Most-sold product is listed first.
    expect($res->json('data.products.0.name'))->toBe('Beygir');
});

it('requires a manager (guests are unauthenticated)', function () {
    getJson('/v1/admin/analytics/heatmap')->assertUnauthorized();
});
