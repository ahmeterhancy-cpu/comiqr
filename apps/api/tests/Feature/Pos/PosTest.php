<?php

use App\Enums\Role;
use App\Models\Branch;
use App\Models\Category;
use App\Models\Payment;
use App\Models\Product;
use App\Models\Table;
use App\Models\Tenant;
use App\Models\User;
use App\Support\Tenancy\TenantManager;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;

use function Pest\Laravel\getJson;
use function Pest\Laravel\postJson;

uses(RefreshDatabase::class);

function posVenue(): array
{
    $tenant = Tenant::factory()->create();

    return app(TenantManager::class)->runAs($tenant, function () use ($tenant) {
        Branch::factory()->create();
        $cat = Category::factory()->create();
        $product = Product::factory()->forCategory($cat)->create(['price' => 100]);
        $table = Table::factory()->create(['code' => 'M1']);

        return compact('tenant', 'product', 'table');
    });
}

it('lets a waiter read the POS grid (products/categories/tables) to build a ticket', function () {
    // The waiter app bridges into /pos to take orders — it must be able to read the
    // menu, not just POST the order.
    ['tenant' => $tenant] = posVenue();
    Sanctum::actingAs(User::factory()->forTenant($tenant)->role(Role::Waiter)->create());

    getJson('/v1/admin/products')->assertOk();
    getJson('/v1/admin/categories')->assertOk();
    getJson('/v1/admin/tables')->assertOk();
    getJson('/v1/admin/branches')->assertOk();
});

it('lets a waiter create a dine-in POS order and settle it by card', function () {
    ['tenant' => $tenant, 'product' => $product, 'table' => $table] = posVenue();
    Sanctum::actingAs(User::factory()->forTenant($tenant)->role(Role::Waiter)->create());

    $orderId = postJson('/v1/admin/pos/orders', [
        'table_id' => $table->id,
        'items' => [['product_id' => $product->id, 'quantity' => 2]],
    ])
        ->assertCreated()
        ->assertJsonPath('data.source', 'pos')
        ->assertJsonPath('data.subtotal', '200.00')
        ->json('data.id');

    postJson("/v1/admin/pos/orders/{$orderId}/pay", ['gateway' => 'card'])
        ->assertOk()
        ->assertJsonPath('data.payment_status', 'paid');

    expect(Payment::withoutTenancy()->where('order_id', $orderId)->value('gateway'))->toBe('card');
});

it('creates a counter/takeaway POS order without a table', function () {
    ['tenant' => $tenant, 'product' => $product] = posVenue();
    Sanctum::actingAs(User::factory()->forTenant($tenant)->role(Role::Manager)->create());

    postJson('/v1/admin/pos/orders', ['items' => [['product_id' => $product->id, 'quantity' => 1]]])
        ->assertCreated()
        ->assertJsonPath('data.type', 'takeaway')
        ->assertJsonPath('data.source', 'pos');
});

it('forbids kitchen staff from using the POS', function () {
    ['tenant' => $tenant, 'product' => $product] = posVenue();
    Sanctum::actingAs(User::factory()->forTenant($tenant)->role(Role::Kitchen)->create());

    postJson('/v1/admin/pos/orders', ['items' => [['product_id' => $product->id, 'quantity' => 1]]])
        ->assertForbidden();
});

it('will not settle an already-paid POS order twice', function () {
    ['tenant' => $tenant, 'product' => $product, 'table' => $table] = posVenue();
    Sanctum::actingAs(User::factory()->forTenant($tenant)->role(Role::Waiter)->create());

    $orderId = postJson('/v1/admin/pos/orders', [
        'table_id' => $table->id,
        'items' => [['product_id' => $product->id, 'quantity' => 1]],
    ])->json('data.id');

    postJson("/v1/admin/pos/orders/{$orderId}/pay", ['gateway' => 'cash'])->assertOk();
    postJson("/v1/admin/pos/orders/{$orderId}/pay", ['gateway' => 'cash'])->assertStatus(422);
});
