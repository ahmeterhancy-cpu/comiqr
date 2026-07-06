<?php

use App\Enums\Role;
use App\Models\Branch;
use App\Models\Category;
use App\Models\Product;
use App\Models\Shift;
use App\Models\Table;
use App\Models\Tenant;
use App\Models\User;
use App\Support\Tenancy\TenantManager;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;

use function Pest\Laravel\getJson;
use function Pest\Laravel\postJson;

uses(RefreshDatabase::class);

/** @param array<string,mixed> $tenantAttrs */
function posShop(array $tenantAttrs = []): array
{
    $tenant = Tenant::factory()->create($tenantAttrs);

    return app(TenantManager::class)->runAs($tenant, function () use ($tenant) {
        Branch::factory()->create();
        $cat = Category::factory()->create();
        $product = Product::factory()->forCategory($cat)->create(['price' => 100]);
        $table = Table::factory()->create(['code' => 'M1']);

        return compact('tenant', 'product', 'table');
    });
}

function actAsCashier(Tenant $tenant): void
{
    Sanctum::actingAs(User::factory()->forTenant($tenant)->role(Role::Waiter)->create());
}

it('recalls open POS tabs with their table code', function () {
    ['tenant' => $tenant, 'product' => $product, 'table' => $table] = posShop();
    actAsCashier($tenant);

    postJson('/v1/admin/pos/orders', [
        'table_id' => $table->id,
        'items' => [['product_id' => $product->id, 'quantity' => 1]],
    ])->assertCreated();

    getJson('/v1/admin/pos/orders')
        ->assertOk()
        ->assertJsonPath('data.0.table_code', 'M1')
        ->assertJsonPath('data.0.payment_status', 'unpaid');
});

it('adds another round to an open POS order', function () {
    ['tenant' => $tenant, 'product' => $product, 'table' => $table] = posShop();
    actAsCashier($tenant);

    $orderId = postJson('/v1/admin/pos/orders', [
        'table_id' => $table->id,
        'items' => [['product_id' => $product->id, 'quantity' => 1]],
    ])->json('data.id');

    postJson("/v1/admin/pos/orders/{$orderId}/items", [
        'items' => [['product_id' => $product->id, 'quantity' => 2]],
    ])
        ->assertOk()
        ->assertJsonPath('data.subtotal', '300.00');
});

it('voids a line and shrinks the total', function () {
    ['tenant' => $tenant, 'product' => $product, 'table' => $table] = posShop();
    actAsCashier($tenant);

    $order = postJson('/v1/admin/pos/orders', [
        'table_id' => $table->id,
        'items' => [
            ['product_id' => $product->id, 'quantity' => 2],
            ['product_id' => $product->id, 'quantity' => 1],
        ],
    ])->assertJsonPath('data.subtotal', '300.00')->json('data');

    $itemId = $order['items'][0]['id']; // the qty-2 (200) line

    postJson("/v1/admin/pos/orders/{$order['id']}/items/{$itemId}/void")
        ->assertOk()
        ->assertJsonPath('data.subtotal', '100.00')
        ->assertJsonPath('data.items.0.status', 'cancelled');
});

it('applies a percentage discount capped at the subtotal', function () {
    ['tenant' => $tenant, 'product' => $product, 'table' => $table] = posShop();
    actAsCashier($tenant);

    $orderId = postJson('/v1/admin/pos/orders', [
        'table_id' => $table->id,
        'items' => [['product_id' => $product->id, 'quantity' => 2]], // 200
    ])->json('data.id');

    postJson("/v1/admin/pos/orders/{$orderId}/discount", ['type' => 'percent', 'value' => 10])
        ->assertOk()
        ->assertJsonPath('data.discount_total', '20.00')
        ->assertJsonPath('data.grand_total', '180.00');

    // An over-large fixed discount is clamped to the subtotal (never negative total).
    postJson("/v1/admin/pos/orders/{$orderId}/discount", ['type' => 'amount', 'value' => 9999])
        ->assertOk()
        ->assertJsonPath('data.discount_total', '200.00')
        ->assertJsonPath('data.grand_total', '0.00');
});

it('settles an order across two split payments', function () {
    ['tenant' => $tenant, 'product' => $product, 'table' => $table] = posShop();
    actAsCashier($tenant);

    $orderId = postJson('/v1/admin/pos/orders', [
        'table_id' => $table->id,
        'items' => [['product_id' => $product->id, 'quantity' => 2]], // 200
    ])->json('data.id');

    postJson("/v1/admin/pos/orders/{$orderId}/pay", ['gateway' => 'cash', 'amount' => 120])
        ->assertOk()
        ->assertJsonPath('data.payment_status', 'partially_paid');

    postJson("/v1/admin/pos/orders/{$orderId}/pay", ['gateway' => 'card', 'amount' => 80])
        ->assertOk()
        ->assertJsonPath('data.payment_status', 'paid');
});

it('gates charge-to-room on folio verticals', function () {
    // Default restaurant vertical → folio disabled.
    ['tenant' => $tenant, 'product' => $product, 'table' => $table] = posShop();
    actAsCashier($tenant);
    $orderId = postJson('/v1/admin/pos/orders', [
        'table_id' => $table->id,
        'items' => [['product_id' => $product->id, 'quantity' => 1]],
    ])->json('data.id');
    postJson("/v1/admin/pos/orders/{$orderId}/charge-to-room")->assertStatus(422);

    // Hotel vertical → allowed.
    ['tenant' => $hotel, 'product' => $hp, 'table' => $ht] = posShop(['settings_json' => ['vertical' => 'hotel']]);
    actAsCashier($hotel);
    $hotelOrderId = postJson('/v1/admin/pos/orders', [
        'table_id' => $ht->id,
        'items' => [['product_id' => $hp->id, 'quantity' => 1]],
    ])->json('data.id');
    postJson("/v1/admin/pos/orders/{$hotelOrderId}/charge-to-room")
        ->assertOk()
        ->assertJsonPath('data.charged_to_room', true);
});

it('runs a cash-drawer shift and produces a Z-report', function () {
    ['tenant' => $tenant, 'product' => $product, 'table' => $table] = posShop();
    actAsCashier($tenant);

    postJson('/v1/admin/pos/shift/open', ['opening_float' => 100])
        ->assertCreated()
        ->assertJsonPath('data.status', 'open')
        ->assertJsonPath('data.opening_float', 100);

    // A second open shift is refused while one is open.
    postJson('/v1/admin/pos/shift/open', ['opening_float' => 50])->assertStatus(422);

    // Ring a cash sale of 200 → drawer should expect 100 + 200 = 300.
    $orderId = postJson('/v1/admin/pos/orders', [
        'table_id' => $table->id,
        'items' => [['product_id' => $product->id, 'quantity' => 2]],
    ])->json('data.id');
    postJson("/v1/admin/pos/orders/{$orderId}/pay", ['gateway' => 'cash'])->assertOk();

    getJson('/v1/admin/pos/shift/current')
        ->assertOk()
        ->assertJsonPath('data.cash_sales', 200)
        ->assertJsonPath('data.expected_cash', 300);

    $shiftId = Shift::withoutTenancy()->where('tenant_id', $tenant->id)->value('id');

    // Count 290 in the drawer → 10 short.
    postJson("/v1/admin/pos/shift/{$shiftId}/close", ['counted_cash' => 290])
        ->assertOk()
        ->assertJsonPath('data.status', 'closed')
        ->assertJsonPath('data.expected_cash', 300)
        ->assertJsonPath('data.over_short', -10);
});

it('forbids kitchen staff from the POS shift + recall endpoints', function () {
    ['tenant' => $tenant] = posShop();
    Sanctum::actingAs(User::factory()->forTenant($tenant)->role(Role::Kitchen)->create());

    getJson('/v1/admin/pos/orders')->assertForbidden();
    postJson('/v1/admin/pos/shift/open', ['opening_float' => 0])->assertForbidden();
});

it('closes the order when a tip is left on a full payment (tip settles, never strands)', function () {
    ['tenant' => $tenant, 'product' => $product, 'table' => $table] = posShop();
    actAsCashier($tenant);

    $orderId = postJson('/v1/admin/pos/orders', [
        'table_id' => $table->id,
        'items' => [['product_id' => $product->id, 'quantity' => 1]], // 100
    ])->json('data.id');

    postJson("/v1/admin/pos/orders/{$orderId}/pay", ['gateway' => 'cash', 'amount' => 100, 'tip' => 15])
        ->assertOk()
        ->assertJsonPath('data.payment_status', 'paid') // tip must not strand a balance
        ->assertJsonPath('data.tip_total', '15.00')
        ->assertJsonPath('data.grand_total', '115.00')
        ->assertJsonPath('data.paid_total', 115);
});

it('keeps a manual POS discount when the tab grows (happy-hour must not clobber it)', function () {
    ['tenant' => $tenant, 'product' => $product, 'table' => $table] = posShop([
        'settings_json' => ['vertical' => 'bar', 'happy_hour' => ['enabled' => true, 'start' => '00:00', 'end' => '23:59', 'percent' => 50]],
    ]);
    actAsCashier($tenant);

    $orderId = postJson('/v1/admin/pos/orders', [
        'table_id' => $table->id,
        'items' => [['product_id' => $product->id, 'quantity' => 1]], // 100 (placed with 50% happy-hour)
    ])->json('data.id');

    // Cashier overrides with a small manual discount…
    postJson("/v1/admin/pos/orders/{$orderId}/discount", ['type' => 'amount', 'value' => 10])
        ->assertOk()->assertJsonPath('data.discount_total', '10.00');

    // …and adding a round must NOT let the 50% happy-hour recompute overwrite it.
    postJson("/v1/admin/pos/orders/{$orderId}/items", ['items' => [['product_id' => $product->id, 'quantity' => 1]]])
        ->assertOk()
        ->assertJsonPath('data.discount_total', '10.00');
});

it('refunds collected money and flips the order back to partially paid then unpaid', function () {
    ['tenant' => $tenant, 'product' => $product, 'table' => $table] = posShop();
    actAsCashier($tenant);

    $orderId = postJson('/v1/admin/pos/orders', [
        'table_id' => $table->id,
        'items' => [['product_id' => $product->id, 'quantity' => 2]], // 200
    ])->json('data.id');
    postJson("/v1/admin/pos/orders/{$orderId}/pay", ['gateway' => 'cash'])
        ->assertOk()->assertJsonPath('data.payment_status', 'paid')->assertJsonPath('data.paid_total', 200);

    postJson("/v1/admin/pos/orders/{$orderId}/refund", ['amount' => 50, 'gateway' => 'cash', 'reason' => 'yanlış ürün'])
        ->assertOk()
        ->assertJsonPath('data.payment_status', 'partially_paid')
        ->assertJsonPath('data.paid_total', 150);

    postJson("/v1/admin/pos/orders/{$orderId}/refund", ['amount' => 150, 'gateway' => 'cash'])
        ->assertOk()
        ->assertJsonPath('data.payment_status', 'unpaid')
        ->assertJsonPath('data.paid_total', 0);
});

it('rejects a refund with nothing collected and caps an over-refund', function () {
    ['tenant' => $tenant, 'product' => $product, 'table' => $table] = posShop();
    actAsCashier($tenant);

    $orderId = postJson('/v1/admin/pos/orders', [
        'table_id' => $table->id,
        'items' => [['product_id' => $product->id, 'quantity' => 1]], // 100
    ])->json('data.id');

    postJson("/v1/admin/pos/orders/{$orderId}/refund", ['amount' => 50])->assertStatus(422); // nothing paid

    postJson("/v1/admin/pos/orders/{$orderId}/pay", ['gateway' => 'card'])->assertOk();
    postJson("/v1/admin/pos/orders/{$orderId}/refund", ['amount' => 9999, 'gateway' => 'card'])
        ->assertOk()
        ->assertJsonPath('data.paid_total', 0) // capped at what was collected
        ->assertJsonPath('data.payment_status', 'unpaid');
});

it('discounts a single line and shrinks the order total', function () {
    ['tenant' => $tenant, 'product' => $product, 'table' => $table] = posShop();
    actAsCashier($tenant);

    $order = postJson('/v1/admin/pos/orders', [
        'table_id' => $table->id,
        'items' => [['product_id' => $product->id, 'quantity' => 2]], // 200
    ])->json('data');
    $itemId = $order['items'][0]['id'];

    postJson("/v1/admin/pos/orders/{$order['id']}/items/{$itemId}/discount", ['type' => 'percent', 'value' => 25])
        ->assertOk()
        ->assertJsonPath('data.items.0.discount_total', '50.00')
        ->assertJsonPath('data.items.0.line_total', '150.00')
        ->assertJsonPath('data.subtotal', '150.00')
        ->assertJsonPath('data.grand_total', '150.00');
});

it('clamps an order discount when a line discount shrinks the subtotal below it', function () {
    ['tenant' => $tenant, 'product' => $product, 'table' => $table] = posShop();
    actAsCashier($tenant);

    $order = postJson('/v1/admin/pos/orders', [
        'table_id' => $table->id,
        'items' => [['product_id' => $product->id, 'quantity' => 2]], // 200
    ])->json('data');

    postJson("/v1/admin/pos/orders/{$order['id']}/discount", ['type' => 'amount', 'value' => 150])
        ->assertOk()->assertJsonPath('data.grand_total', '50.00');

    // 100% off the only line → subtotal 0; the 150 order discount must clamp, no negative total.
    $itemId = $order['items'][0]['id'];
    postJson("/v1/admin/pos/orders/{$order['id']}/items/{$itemId}/discount", ['type' => 'percent', 'value' => 100])
        ->assertOk()
        ->assertJsonPath('data.subtotal', '0.00')
        ->assertJsonPath('data.discount_total', '0.00')
        ->assertJsonPath('data.grand_total', '0.00');
});

it('refuses a cash refund on a card-only sale but allows a card refund', function () {
    ['tenant' => $tenant, 'product' => $product, 'table' => $table] = posShop();
    actAsCashier($tenant);

    $orderId = postJson('/v1/admin/pos/orders', [
        'table_id' => $table->id,
        'items' => [['product_id' => $product->id, 'quantity' => 1]], // 100
    ])->json('data.id');
    postJson("/v1/admin/pos/orders/{$orderId}/pay", ['gateway' => 'card'])->assertOk();

    postJson("/v1/admin/pos/orders/{$orderId}/refund", ['amount' => 50, 'gateway' => 'cash'])->assertStatus(422);
    postJson("/v1/admin/pos/orders/{$orderId}/refund", ['amount' => 50, 'gateway' => 'card'])
        ->assertOk()->assertJsonPath('data.payment_status', 'partially_paid');
});

it('reverses earned loyalty points when a paid order is fully refunded', function () {
    $tenant = Tenant::factory()->create();
    [$accountId, $orderId] = app(TenantManager::class)->runAs($tenant, function () use ($tenant) {
        Branch::factory()->create();
        $cat = Category::factory()->create();
        $product = Product::factory()->forCategory($cat)->create(['price' => 100]);
        $table = Table::factory()->create();
        $customer = App\Models\Customer::factory()->create();
        $account = App\Models\LoyaltyAccount::create(['tenant_id' => $tenant->id, 'customer_id' => $customer->id, 'points_balance' => 0]);
        $session = App\Models\TableSession::create(['table_id' => $table->id, 'status' => 'open', 'opened_at' => now()]);
        $order = app(App\Services\OrderService::class)->place($table, $session, [['product_id' => $product->id, 'quantity' => 2]], null, $customer); // 200

        return [$account->id, $order->id];
    });
    $balance = fn () => app(TenantManager::class)->runAs($tenant, fn () => (int) App\Models\LoyaltyAccount::find($accountId)->points_balance);

    Sanctum::actingAs(User::factory()->forTenant($tenant)->role(Role::Waiter)->create());

    postJson("/v1/admin/pos/orders/{$orderId}/pay", ['gateway' => 'cash'])->assertJsonPath('data.payment_status', 'paid');
    expect($balance())->toBe(20); // floor(200 * 0.1)

    postJson("/v1/admin/pos/orders/{$orderId}/refund", ['amount' => 200, 'gateway' => 'cash'])
        ->assertOk()->assertJsonPath('data.payment_status', 'unpaid');
    expect($balance())->toBe(0); // points reversed
});

it('a cash refund is pulled back out of the drawer in the Z-report', function () {
    ['tenant' => $tenant, 'product' => $product, 'table' => $table] = posShop();
    actAsCashier($tenant);

    postJson('/v1/admin/pos/shift/open', ['opening_float' => 100])->assertCreated();

    $orderId = postJson('/v1/admin/pos/orders', [
        'table_id' => $table->id,
        'items' => [['product_id' => $product->id, 'quantity' => 2]], // 200
    ])->json('data.id');
    postJson("/v1/admin/pos/orders/{$orderId}/pay", ['gateway' => 'cash'])->assertOk();
    postJson("/v1/admin/pos/orders/{$orderId}/refund", ['amount' => 50, 'gateway' => 'cash'])->assertOk();

    getJson('/v1/admin/pos/shift/current')
        ->assertOk()
        ->assertJsonPath('data.cash_sales', 150)     // 200 in, 50 back out
        ->assertJsonPath('data.expected_cash', 250); // 100 float + 150 net
});
