<?php

use App\Enums\Role;
use App\Models\Branch;
use App\Models\Category;
use App\Models\Order;
use App\Models\Product;
use App\Models\Table;
use App\Models\TableSession;
use App\Models\Tenant;
use App\Models\User;
use App\Services\OrderService;
use App\Support\Tenancy\TenantManager;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;

use function Pest\Laravel\deleteJson;
use function Pest\Laravel\getJson;
use function Pest\Laravel\postJson;

uses(RefreshDatabase::class);

function kitchenScenario(): array
{
    $tenant = Tenant::factory()->create();

    return app(TenantManager::class)->runAs($tenant, function () use ($tenant) {
        $branch = Branch::factory()->create();
        $category = Category::factory()->create();
        $product = Product::factory()->forCategory($category)->create(['price' => 100]);
        $table = Table::factory()->forBranch($branch)->create();
        $session = TableSession::create(['table_id' => $table->id, 'status' => 'open', 'opened_at' => now()]);

        $order = app(OrderService::class)->place($table, $session, [
            ['product_id' => $product->id, 'quantity' => 1],
        ]);

        return compact('tenant', 'branch', 'product', 'table', 'order');
    });
}

it('lists active tickets and advances item status to update the order', function () {
    ['tenant' => $tenant, 'branch' => $branch, 'order' => $order] = kitchenScenario();
    Sanctum::actingAs(User::factory()->forTenant($tenant)->role(Role::Kitchen)->create());

    $item = getJson("/v1/kds/{$branch->id}/orders")
        ->assertOk()
        ->assertJsonPath('data.0.order_id', $order->id)
        ->json('data.0.items.0.id');

    postJson("/v1/kds/order-items/{$item}/status", ['status' => 'preparing'])
        ->assertOk()
        ->assertJsonPath('data.status', 'preparing')
        ->assertJsonPath('data.order_status', 'preparing');

    postJson("/v1/kds/order-items/{$item}/bump")
        ->assertOk()
        ->assertJsonPath('data.status', 'served')
        ->assertJsonPath('data.order_status', 'served');

    // Served order drops off the KDS board.
    getJson("/v1/kds/{$branch->id}/orders")->assertOk()->assertJsonCount(0, 'data');
});

it('86s a product and hides it from the menu, then restores it', function () {
    ['tenant' => $tenant, 'branch' => $branch, 'product' => $product, 'table' => $table] = kitchenScenario();
    Sanctum::actingAs(User::factory()->forTenant($tenant)->role(Role::Kitchen)->create());

    getJson("/v1/menu/{$table->qr_token}")->assertJsonCount(1, 'data.categories.0.products');

    $id = postJson('/v1/kds/eighty-six', ['branch_id' => $branch->id, 'product_id' => $product->id])
        ->assertCreated()->json('data.id');

    getJson("/v1/menu/{$table->qr_token}")->assertJsonCount(0, 'data.categories.0.products');

    deleteJson("/v1/kds/eighty-six/{$id}")->assertOk();
    getJson("/v1/menu/{$table->qr_token}")->assertJsonCount(1, 'data.categories.0.products');
});

it('forbids a waiter from using the KDS', function () {
    ['tenant' => $tenant, 'branch' => $branch] = kitchenScenario();
    Sanctum::actingAs(User::factory()->forTenant($tenant)->role(Role::Waiter)->create());

    getJson("/v1/kds/{$branch->id}/orders")->assertForbidden();
});
