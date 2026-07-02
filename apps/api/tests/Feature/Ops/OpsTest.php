<?php

use App\Enums\Role;
use App\Models\Branch;
use App\Models\Category;
use App\Models\Plan;
use App\Models\Product;
use App\Models\Table;
use App\Models\TableSession;
use App\Models\Tenant;
use App\Models\User;
use App\Services\OrderService;
use App\Support\Tenancy\TenantManager;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;

use function Pest\Laravel\getJson;
use function Pest\Laravel\postJson;

uses(RefreshDatabase::class);

beforeEach(fn () => $this->seed(Database\Seeders\PlanSeeder::class));

function venueOn(string $planCode): array
{
    $tenant = Tenant::factory()->create(['plan_id' => Plan::firstWhere('code', $planCode)?->id]);

    return app(TenantManager::class)->runAs($tenant, function () use ($tenant) {
        $branch = Branch::factory()->create();
        $category = Category::factory()->create();
        $product = Product::factory()->forCategory($category)->create(['price' => 100]);
        $table = Table::factory()->forBranch($branch)->create();

        return compact('tenant', 'branch', 'category', 'product', 'table');
    });
}

it('blocks ordering on the Free plan but allows it on Pro (M12)', function () {
    ['product' => $free, 'table' => $freeTable] = venueOn('free');
    postJson("/v1/sessions/{$freeTable->qr_token}/orders", [
        'items' => [['product_id' => $free->id, 'quantity' => 1]],
    ])->assertStatus(402);

    ['product' => $pro, 'table' => $proTable] = venueOn('pro');
    postJson("/v1/sessions/{$proTable->qr_token}/orders", [
        'items' => [['product_id' => $pro->id, 'quantity' => 1]],
    ])->assertCreated();
});

it('logs menu views and reports analytics (M9)', function () {
    ['tenant' => $tenant, 'table' => $table] = venueOn('pro');

    postJson("/v1/menu/{$table->qr_token}/view")->assertOk();
    postJson("/v1/menu/{$table->qr_token}/view")->assertOk();

    Sanctum::actingAs(User::factory()->forTenant($tenant)->role(Role::Manager)->create());

    getJson('/v1/admin/analytics/overview')
        ->assertOk()
        ->assertJsonPath('data.scans', 2);
});

it('gates analytics behind the plan (M9/M12)', function () {
    ['tenant' => $tenant] = venueOn('free');
    Sanctum::actingAs(User::factory()->forTenant($tenant)->role(Role::Manager)->create());

    getJson('/v1/admin/analytics/overview')->assertStatus(402);
});

it('shows the waiter board with a service call and serves an item (M10)', function () {
    ['tenant' => $tenant, 'product' => $product, 'table' => $table] = venueOn('pro');

    [$session, $order] = app(TenantManager::class)->runAs($tenant, function () use ($table, $product) {
        $session = TableSession::create(['table_id' => $table->id, 'status' => 'open', 'opened_at' => now()]);
        $order = app(OrderService::class)->place($table, $session, [['product_id' => $product->id, 'quantity' => 1]]);
        $order->items()->update(['status' => 'ready']);

        return [$session, $order];
    });

    postJson("/v1/sessions/{$table->qr_token}/call-waiter")->assertOk();

    Sanctum::actingAs(User::factory()->forTenant($tenant)->role(Role::Waiter)->create());

    getJson('/v1/waiter/tables')
        ->assertOk()
        ->assertJsonPath('data.0.state', 'occupied')
        ->assertJsonPath('data.0.waiter_called', true);

    getJson('/v1/waiter/notifications')
        ->assertOk()
        ->assertJsonCount(1, 'data.ready_items');

    $itemId = $order->items()->first()->id;
    postJson("/v1/waiter/order-items/{$itemId}/served")
        ->assertOk()
        ->assertJsonPath('data.status', 'served')
        ->assertJsonPath('data.order_status', 'served');
});
