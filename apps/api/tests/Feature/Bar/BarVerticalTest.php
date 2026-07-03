<?php

use App\Models\Branch;
use App\Models\Category;
use App\Models\Product;
use App\Models\Table;
use App\Models\Tenant;
use App\Support\Tenancy\TenantManager;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;

use function Pest\Laravel\getJson;
use function Pest\Laravel\postJson;

uses(RefreshDatabase::class);

/** Seed a venue with a 100 TL product; $happy is merged into settings_json. */
function seedBar(array $happy = [], string $vertical = 'bar'): array
{
    $tenant = Tenant::factory()->create([
        'timezone' => 'Asia/Nicosia',
        'settings_json' => array_merge(['vertical' => $vertical], $happy),
    ]);

    return app(TenantManager::class)->runAs($tenant, function () use ($tenant) {
        Branch::factory()->create();
        $cat = Category::factory()->create();
        $product = Product::factory()->forCategory($cat)->create(['name' => 'Efes', 'price' => 100, 'age_restricted' => true]);
        $table = Table::factory()->create(['code' => 'B1']);

        return compact('tenant', 'product', 'table');
    });
}

function placeBarOrder(Table $table, Product $product) {
    return postJson("/v1/sessions/{$table->qr_token}/orders", [
        'items' => [['product_id' => $product->id, 'quantity' => 1]],
    ]);
}

it('flags age-restricted products on the menu', function () {
    ['table' => $table] = seedBar();

    getJson("/v1/menu/{$table->qr_token}")
        ->assertOk()
        ->assertJsonPath('data.categories.0.products.0.age_restricted', true)
        ->assertJsonPath('data.venue.vertical', 'bar');
});

it('applies the happy-hour discount at order time (within the window)', function () {
    Carbon::setTestNow(Carbon::parse('2026-07-03 23:00', 'Asia/Nicosia')); // window 22:00–02:00
    ['product' => $product, 'table' => $table] = seedBar([
        'happy_hour' => ['enabled' => true, 'start' => '22:00', 'end' => '02:00', 'percent' => 20],
    ]);

    placeBarOrder($table, $product)
        ->assertCreated()
        ->assertJsonPath('data.subtotal', '100.00')
        ->assertJsonPath('data.discount_total', '20.00')
        ->assertJsonPath('data.grand_total', '80.00');

    Carbon::setTestNow();
});

it('does not discount outside the happy-hour window', function () {
    Carbon::setTestNow(Carbon::parse('2026-07-03 15:00', 'Asia/Nicosia'));
    ['product' => $product, 'table' => $table] = seedBar([
        'happy_hour' => ['enabled' => true, 'start' => '22:00', 'end' => '02:00', 'percent' => 20],
    ]);

    placeBarOrder($table, $product)
        ->assertCreated()
        ->assertJsonPath('data.grand_total', '100.00'); // full price — no happy-hour discount

    Carbon::setTestNow();
});

it('exposes the active happy-hour on the menu payload', function () {
    Carbon::setTestNow(Carbon::parse('2026-07-03 23:30', 'Asia/Nicosia'));
    ['table' => $table] = seedBar([
        'happy_hour' => ['enabled' => true, 'start' => '22:00', 'end' => '02:00', 'percent' => 25],
    ]);

    getJson("/v1/menu/{$table->qr_token}")
        ->assertOk()
        ->assertJsonPath('data.venue.happy_hour.active', true)
        ->assertJsonPath('data.venue.happy_hour.percent', 25);

    Carbon::setTestNow();
});

it('ignores a disabled happy-hour', function () {
    Carbon::setTestNow(Carbon::parse('2026-07-03 23:00', 'Asia/Nicosia'));
    ['product' => $product, 'table' => $table] = seedBar([
        'happy_hour' => ['enabled' => false, 'start' => '22:00', 'end' => '02:00', 'percent' => 20],
    ]);

    placeBarOrder($table, $product)->assertCreated()->assertJsonPath('data.grand_total', '100.00');

    Carbon::setTestNow();
});

it('never applies happy-hour to a non-bar vertical (even if enabled)', function () {
    Carbon::setTestNow(Carbon::parse('2026-07-03 23:00', 'Asia/Nicosia'));
    ['product' => $product, 'table' => $table] = seedBar([
        'happy_hour' => ['enabled' => true, 'start' => '22:00', 'end' => '02:00', 'percent' => 20],
    ], 'restaurant');

    placeBarOrder($table, $product)->assertCreated()->assertJsonPath('data.grand_total', '100.00');
    getJson("/v1/menu/{$table->qr_token}")->assertOk()->assertJsonPath('data.venue.happy_hour.active', false);

    Carbon::setTestNow();
});

it('re-scales the happy-hour discount when the order grows via addItems', function () {
    Carbon::setTestNow(Carbon::parse('2026-07-03 23:00', 'Asia/Nicosia'));
    ['product' => $product, 'table' => $table] = seedBar([
        'happy_hour' => ['enabled' => true, 'start' => '22:00', 'end' => '02:00', 'percent' => 20],
    ]);

    $orderId = placeBarOrder($table, $product)->assertCreated()->json('data.id');

    // Add a second 100 TL item → subtotal 200, discount must re-scale to 40 (20%).
    postJson("/v1/sessions/{$table->qr_token}/orders/{$orderId}/items", [
        'items' => [['product_id' => $product->id, 'quantity' => 1]],
    ])
        ->assertOk()
        ->assertJsonPath('data.subtotal', '200.00')
        ->assertJsonPath('data.discount_total', '40.00')
        ->assertJsonPath('data.grand_total', '160.00');

    Carbon::setTestNow();
});
