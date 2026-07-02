<?php

use App\Enums\Role;
use App\Models\Branch;
use App\Models\Category;
use App\Models\Coupon;
use App\Models\Plan;
use App\Models\Product;
use App\Models\Table;
use App\Models\Tenant;
use App\Models\User;
use App\Support\Tenancy\TenantManager;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;

use function Pest\Laravel\postJson;

uses(RefreshDatabase::class);

beforeEach(fn () => $this->seed(Database\Seeders\PlanSeeder::class));

function couponVenue(): array
{
    $tenant = Tenant::factory()->create(['plan_id' => Plan::firstWhere('code', 'pro')->id]);

    return app(TenantManager::class)->runAs($tenant, function () use ($tenant) {
        $branch = Branch::factory()->create();
        $category = Category::factory()->create();
        $product = Product::factory()->forCategory($category)->create(['price' => 100]);
        $table = Table::factory()->forBranch($branch)->create();

        return compact('tenant', 'product', 'table');
    });
}

it('applies a percentage coupon to an order', function () {
    ['tenant' => $tenant, 'product' => $product, 'table' => $table] = couponVenue();
    Sanctum::actingAs(User::factory()->forTenant($tenant)->role(Role::Manager)->create());

    postJson('/v1/admin/coupons', ['code' => 'INDIRIM20', 'type' => 'percent', 'value' => 20])
        ->assertCreated();

    $orderId = postJson("/v1/sessions/{$table->qr_token}/orders", [
        'items' => [['product_id' => $product->id, 'quantity' => 1]],
    ])->json('data.id');

    postJson("/v1/sessions/{$table->qr_token}/orders/{$orderId}/apply-coupon", ['code' => 'INDIRIM20'])
        ->assertOk()
        ->assertJsonPath('data.discount_total', '20.00')
        ->assertJsonPath('data.grand_total', '80.00');

    expect(app(TenantManager::class)->runAs($tenant, fn () => Coupon::first()->used_count))->toBe(1);
});

it('rejects an unknown or inactive coupon', function () {
    ['tenant' => $tenant, 'product' => $product, 'table' => $table] = couponVenue();

    $orderId = postJson("/v1/sessions/{$table->qr_token}/orders", [
        'items' => [['product_id' => $product->id, 'quantity' => 1]],
    ])->json('data.id');

    postJson("/v1/sessions/{$table->qr_token}/orders/{$orderId}/apply-coupon", ['code' => 'NOPE'])
        ->assertStatus(422);

    app(TenantManager::class)->runAs($tenant, fn () => Coupon::factory()->create(['code' => 'OFF', 'is_active' => false]));

    postJson("/v1/sessions/{$table->qr_token}/orders/{$orderId}/apply-coupon", ['code' => 'OFF'])
        ->assertStatus(422);
});

it('enforces a minimum subtotal condition', function () {
    ['tenant' => $tenant, 'product' => $product, 'table' => $table] = couponVenue();
    app(TenantManager::class)->runAs($tenant, fn () => Coupon::factory()->create([
        'code' => 'BIG', 'type' => 'amount', 'value' => 30, 'conditions_json' => ['min_subtotal' => 200],
    ]));

    $orderId = postJson("/v1/sessions/{$table->qr_token}/orders", [
        'items' => [['product_id' => $product->id, 'quantity' => 1]], // subtotal 100 < 200
    ])->json('data.id');

    postJson("/v1/sessions/{$table->qr_token}/orders/{$orderId}/apply-coupon", ['code' => 'BIG'])
        ->assertStatus(422);
});
