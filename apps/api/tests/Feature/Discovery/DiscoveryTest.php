<?php

use App\Models\Category;
use App\Models\Product;
use App\Models\Tenant;
use App\Support\Tenancy\TenantManager;
use Illuminate\Foundation\Testing\RefreshDatabase;

use function Pest\Laravel\getJson;

uses(RefreshDatabase::class);

/** Give a tenant a category with N active products. */
function venueWithMenu(Tenant $tenant, int $products): void
{
    app(TenantManager::class)->runAs($tenant, function () use ($products) {
        $category = Category::factory()->create();
        for ($i = 0; $i < $products; $i++) {
            Product::factory()->forCategory($category)->create(['name' => "Ürün {$i}", 'is_active' => true]);
        }
    });
}

it('lists only active venues that have a live menu', function () {
    $withMenu = Tenant::factory()->create(['name' => 'Girne Meze', 'status' => 'active']);
    $emptyMenu = Tenant::factory()->create(['name' => 'Boş Mekan', 'status' => 'active']);
    $suspended = Tenant::factory()->create(['name' => 'Kapalı Mekan', 'status' => 'suspended']);

    venueWithMenu($withMenu, 3);
    venueWithMenu($suspended, 2); // has a menu but is suspended → hidden

    $res = getJson('/v1/discover')->assertOk();

    $slugs = collect($res->json('data'))->pluck('slug');
    expect($slugs)->toContain($withMenu->slug)
        ->not->toContain($emptyMenu->slug)   // no products
        ->not->toContain($suspended->slug);  // suspended
});

it('returns product count and up to three sample products', function () {
    $tenant = Tenant::factory()->create(['name' => 'Örnek Mekan', 'status' => 'active']);
    venueWithMenu($tenant, 5);

    $venue = collect(getJson('/v1/discover')->assertOk()->json('data'))
        ->firstWhere('slug', $tenant->slug);

    expect($venue['product_count'])->toBe(5);
    expect($venue['samples'])->toHaveCount(3);
});

it('filters by name query', function () {
    $a = Tenant::factory()->create(['name' => 'Deniz Restoran', 'status' => 'active']);
    $b = Tenant::factory()->create(['name' => 'Dağ Kebap', 'status' => 'active']);
    venueWithMenu($a, 1);
    venueWithMenu($b, 1);

    $slugs = collect(getJson('/v1/discover?q=deniz')->assertOk()->json('data'))->pluck('slug');
    expect($slugs)->toContain($a->slug)->not->toContain($b->slug);
});
