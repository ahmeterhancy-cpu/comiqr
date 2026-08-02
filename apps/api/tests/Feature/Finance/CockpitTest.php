<?php

use App\Enums\Role;
use App\Models\Branch;
use App\Models\Category;
use App\Models\NutritionSummary;
use App\Models\Order;
use App\Models\Product;
use App\Models\Table;
use App\Models\Tenant;
use App\Models\User;
use App\Support\Tenancy\TenantManager;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Laravel\Sanctum\Sanctum;

use function Pest\Laravel\getJson;
use function Pest\Laravel\postJson;

uses(RefreshDatabase::class);

function cockpitProduct(Category $category, string $name, float $price, ?float $vat = null, ?float $cost = null): Product
{
    $product = Product::factory()->forCategory($category)->create([
        'name' => $name, 'price' => $price, 'vat_rate' => $vat,
    ]);

    if ($cost !== null) {
        NutritionSummary::create([
            'product_id' => $product->id,
            'cost_per_portion' => $cost,
            'is_stale' => false,
            'computed_at' => now(),
        ]);
    }

    return $product;
}

/** A sold line, optionally at a given local wall-clock time. */
function cockpitSale(Branch $branch, Product $product, int $qty, ?string $at = null, float $orderDiscount = 0, ?int $staffId = null): Order
{
    $order = Order::factory()->create([
        'branch_id' => $branch->id,
        'placed_at' => $at ? Carbon::parse($at) : now(),
        'status' => 'served',
        'created_by' => $staffId,
    ]);

    $order->items()->create([
        'product_id' => $product->id,
        'quantity' => $qty,
        'unit_price' => $product->price,
        'vat_rate' => $product->vat_rate,
        'unit_cost' => $product->nutritionSummary?->cost_per_portion,
        'line_total' => (float) $product->price * $qty,
        'status' => 'served',
    ]);

    $order->update(['discount_total' => $orderDiscount]);
    $order->recalculateTotals();

    return $order->fresh();
}

it('buckets sales into the venue\'s own weekday × hour grid', function () {
    $tenant = Tenant::factory()->create(['timezone' => 'Europe/Nicosia']);

    app(TenantManager::class)->runAs($tenant, function () {
        $branch = Branch::factory()->create();
        $product = cockpitProduct(Category::factory()->create(), 'Kahve', 50);

        // 2026-08-03 is a Monday. İki satış 20:00'de, biri 09:00'da.
        cockpitSale($branch, $product, 2, '2026-08-03 20:15:00');
        cockpitSale($branch, $product, 1, '2026-08-03 20:40:00');
        cockpitSale($branch, $product, 1, '2026-08-03 09:10:00');
    });

    Sanctum::actingAs(User::factory()->forTenant($tenant)->role(Role::Manager)->create());

    $res = getJson('/v1/admin/reports/cockpit?from=2026-08-01&to=2026-08-04')->assertOk();

    // Pazartesi = 0. 20:00 dilimi 150 TL ve 2 sipariş taşır; zirve orası.
    $res->assertJsonPath('data.hourly.matrix.0.20.revenue', 150)
        ->assertJsonPath('data.hourly.matrix.0.20.orders', 2)
        ->assertJsonPath('data.hourly.matrix.0.9.revenue', 50)
        ->assertJsonPath('data.hourly.peak.weekday', 0)
        ->assertJsonPath('data.hourly.peak.hour', 20);
});

it('spreads an order-level discount across the lines so breakdowns still add up', function () {
    $tenant = Tenant::factory()->create();

    app(TenantManager::class)->runAs($tenant, function () {
        $branch = Branch::factory()->create();
        $category = Category::factory()->create();

        // 200 TL sipariş, 50 TL sipariş indirimi → kategoriye 150 TL yazılmalı.
        cockpitSale($branch, cockpitProduct($category, 'Pizza', 200), 1, null, 50);
    });

    Sanctum::actingAs(User::factory()->forTenant($tenant)->role(Role::Manager)->create());

    $res = getJson('/v1/admin/reports/cockpit')->assertOk();

    // JSON 150.0'ı 150 olarak kodlar — karşılaştırmadan önce float'a çevir.
    expect((float) $res->json('data.categories.0.revenue'))->toBe(150.0);
    // İndirim ayrıca ikram/kayıp tarafında görünür.
    $res->assertJsonPath('data.giveaways.order_discounts', 50);
});

it('breaks VAT out of the inclusive price, by rate', function () {
    $tenant = Tenant::factory()->create(['settings_json' => ['vat_rate' => 10]]);

    app(TenantManager::class)->runAs($tenant, function () {
        $branch = Branch::factory()->create();
        $category = Category::factory()->create();

        // %20'li ürün: 120 TL brüt → 20 KDV, 100 matrah.
        cockpitSale($branch, cockpitProduct($category, 'Bira', 120, 20), 1);
        // Oranı olmayan ürün işletme varsayılanına (%10) düşer: 110 → 10 KDV.
        cockpitSale($branch, cockpitProduct($category, 'Çorba', 110, null), 1);
    });

    Sanctum::actingAs(User::factory()->forTenant($tenant)->role(Role::Manager)->create());

    $res = getJson('/v1/admin/reports/cockpit')->assertOk();

    $byRate = collect($res->json('data.tax.lines'))->keyBy('rate');

    expect((float) $byRate['10']['vat'])->toBe(10.0);
    expect((float) $byRate['10']['net'])->toBe(100.0);
    expect((float) $byRate['20']['vat'])->toBe(20.0);
    expect((float) $byRate['20']['net'])->toBe(100.0);

    $res->assertJsonPath('data.tax.vat_total', 30)
        ->assertJsonPath('data.tax.gross_total', 230)
        ->assertJsonPath('data.tax.default_rate', 10);
});

it('attributes sales to the operator who rang them up, guests to their own row', function () {
    $tenant = Tenant::factory()->create();
    $waiter = User::factory()->forTenant($tenant)->role(Role::Waiter)->create(['name' => 'Garson Ayşe']);

    app(TenantManager::class)->runAs($tenant, function () use ($waiter) {
        $branch = Branch::factory()->create();
        $product = cockpitProduct(Category::factory()->create(), 'Tost', 100);

        cockpitSale($branch, $product, 2, null, 0, $waiter->id); // 200
        cockpitSale($branch, $product, 1);                       // 100, QR misafiri
    });

    Sanctum::actingAs(User::factory()->forTenant($tenant)->role(Role::Manager)->create());

    $rows = collect(getJson('/v1/admin/reports/cockpit')->assertOk()->json('data.staff'));

    $byName = $rows->keyBy(fn ($r) => $r['name'] ?? 'self');
    expect((float) $byName['Garson Ayşe']['revenue'])->toBe(200.0);
    expect((float) $byName['Garson Ayşe']['avg_order'])->toBe(200.0);
    expect((float) $byName['self']['revenue'])->toBe(100.0);
});

it('records the operator on a POS order end to end', function () {
    $tenant = Tenant::factory()->create();

    $ctx = app(TenantManager::class)->runAs($tenant, function () {
        Branch::factory()->create();
        $product = Product::factory()->forCategory(Category::factory()->create())->create(['price' => 60]);
        $table = Table::factory()->create(['code' => 'M1']);

        return compact('product', 'table');
    });

    $cashier = User::factory()->forTenant($tenant)->role(Role::Cashier)->create(['name' => 'Kasiyer Mert']);
    Sanctum::actingAs($cashier);

    postJson('/v1/admin/pos/orders', [
        'table_id' => $ctx['table']->id,
        'items' => [['product_id' => $ctx['product']->id, 'quantity' => 1]],
    ])->assertCreated();

    Sanctum::actingAs(User::factory()->forTenant($tenant)->role(Role::Manager)->create());

    $rows = collect(getJson('/v1/admin/reports/cockpit')->assertOk()->json('data.staff'));
    expect($rows->firstWhere('name', 'Kasiyer Mert')['orders'])->toBe(1);
});

it('totals voids and discounts as money given away', function () {
    $tenant = Tenant::factory()->create();

    app(TenantManager::class)->runAs($tenant, function () {
        $branch = Branch::factory()->create();
        $product = cockpitProduct(Category::factory()->create(), 'Kokoreç', 150);

        cockpitSale($branch, $product, 1, null, 30);          // 30 sipariş indirimi
        $voided = cockpitSale($branch, $product, 2);          // 300'lük iptal
        $voided->items()->update(['status' => 'cancelled']);
    });

    Sanctum::actingAs(User::factory()->forTenant($tenant)->role(Role::Manager)->create());

    getJson('/v1/admin/reports/cockpit')
        ->assertOk()
        ->assertJsonPath('data.giveaways.void_lines', 1)
        ->assertJsonPath('data.giveaways.void_amount', 300)
        ->assertJsonPath('data.giveaways.order_discounts', 30)
        ->assertJsonPath('data.giveaways.total', 330);
});

it('keeps another tenant out of every section', function () {
    $other = Tenant::factory()->create();
    app(TenantManager::class)->runAs($other, function () {
        cockpitSale(Branch::factory()->create(), cockpitProduct(Category::factory()->create(), 'Komşu', 500, 20), 3);
    });

    $tenant = Tenant::factory()->create();
    Sanctum::actingAs(User::factory()->forTenant($tenant)->role(Role::Manager)->create());

    $res = getJson('/v1/admin/reports/cockpit')->assertOk();

    expect($res->json('data.categories'))->toBe([]);
    expect($res->json('data.staff'))->toBe([]);
    expect($res->json('data.tax.lines'))->toBe([]);
    $res->assertJsonPath('data.giveaways.total', 0)
        ->assertJsonPath('data.tax.vat_total', 0);
});
