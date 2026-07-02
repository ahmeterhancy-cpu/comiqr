<?php

use App\Events\OrderPlaced;
use App\Events\WaiterCalled;
use App\Models\Branch;
use App\Models\Category;
use App\Models\Modifier;
use App\Models\ModifierGroup;
use App\Models\Product;
use App\Models\ProductVariant;
use App\Models\Table;
use App\Models\Tenant;
use App\Support\Tenancy\TenantManager;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Event;

use function Pest\Laravel\getJson;
use function Pest\Laravel\postJson;

uses(RefreshDatabase::class);

function seedOrderable(): array
{
    $tenant = Tenant::factory()->create();

    return app(TenantManager::class)->runAs($tenant, function () use ($tenant) {
        Branch::factory()->create();
        $category = Category::factory()->create();
        $product = Product::factory()->forCategory($category)->create(['price' => 100]);
        $variant = ProductVariant::create(['product_id' => $product->id, 'name' => 'Large', 'price_delta' => 20]);
        $group = ModifierGroup::factory()->create();
        $modifier = Modifier::create(['modifier_group_id' => $group->id, 'name' => 'Extra Peynir', 'price_delta' => 15]);
        $table = Table::factory()->create(['code' => 'Masa 3']);

        return compact('tenant', 'product', 'variant', 'modifier', 'table');
    });
}

it('places an order with server-computed pricing (variant + modifier)', function () {
    Event::fake([OrderPlaced::class]);
    ['product' => $product, 'variant' => $variant, 'modifier' => $modifier, 'table' => $table] = seedOrderable();

    $response = postJson("/v1/sessions/{$table->qr_token}/orders", [
        'items' => [[
            'product_id' => $product->id,
            'variant_id' => $variant->id,
            'quantity' => 2,
            'modifiers' => [$modifier->id],
        ]],
    ]);

    // unit_price = 100 + 20 (variant) + 15 (modifier) = 135; line = 270.
    $response->assertCreated()
        ->assertJsonPath('data.status', 'pending')
        ->assertJsonPath('data.subtotal', '270.00')
        ->assertJsonPath('data.grand_total', '270.00')
        ->assertJsonPath('data.items.0.unit_price', '135.00')
        ->assertJsonPath('data.items.0.line_total', '270.00')
        ->assertJsonPath('data.items.0.modifiers.0.name', 'Extra Peynir');

    Event::assertDispatched(OrderPlaced::class);
});

it('supports multi-round: adding items to an existing order', function () {
    ['product' => $product, 'table' => $table] = seedOrderable();

    $orderId = postJson("/v1/sessions/{$table->qr_token}/orders", [
        'items' => [['product_id' => $product->id, 'quantity' => 1]],
    ])->json('data.id');

    postJson("/v1/sessions/{$table->qr_token}/orders/{$orderId}/items", [
        'items' => [['product_id' => $product->id, 'quantity' => 3]],
    ])->assertOk()->assertJsonPath('data.subtotal', '400.00'); // 100 + 300

    getJson("/v1/sessions/{$table->qr_token}/orders/{$orderId}")
        ->assertOk()
        ->assertJsonCount(2, 'data.items');
});

it('notifies the waiter and bill via events', function () {
    Event::fake([WaiterCalled::class]);
    ['table' => $table] = seedOrderable();

    postJson("/v1/sessions/{$table->qr_token}/call-waiter")->assertOk()->assertJsonPath('data.called', true);

    Event::assertDispatched(WaiterCalled::class, fn ($e) => $e->tableCode === 'Masa 3');
});

it('rejects ordering against an unknown token', function () {
    postJson('/v1/sessions/bad-token/orders', ['items' => [['product_id' => 1, 'quantity' => 1]]])
        ->assertNotFound();
});

it('does not let one table view another order (token bound)', function () {
    ['product' => $product, 'table' => $tableA] = seedOrderable();
    $orderId = postJson("/v1/sessions/{$tableA->qr_token}/orders", [
        'items' => [['product_id' => $product->id, 'quantity' => 1]],
    ])->json('data.id');

    // A different table (different tenant) cannot read A's order via its own token.
    ['table' => $tableB] = seedOrderable();
    getJson("/v1/sessions/{$tableB->qr_token}/orders/{$orderId}")->assertNotFound();
});
