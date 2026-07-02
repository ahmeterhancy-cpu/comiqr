<?php

use App\Enums\Role;
use App\Models\Branch;
use App\Models\Category;
use App\Models\Customer;
use App\Models\LoyaltyAccount;
use App\Models\Plan;
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

beforeEach(fn () => $this->seed(Database\Seeders\PlanSeeder::class));

function loyaltyVenue(): array
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

it('identifies a customer by phone and earns points on payment', function () {
    ['tenant' => $tenant, 'product' => $product, 'table' => $table] = loyaltyVenue();

    $orderId = postJson("/v1/sessions/{$table->qr_token}/orders", [
        'items' => [['product_id' => $product->id, 'quantity' => 1]],
        'customer' => ['phone' => '+90 533 111 22 33', 'name' => 'Ada'],
    ])->assertCreated()->json('data.id');

    postJson("/v1/sessions/{$table->qr_token}/orders/{$orderId}/pay", ['gateway' => 'cash'])
        ->assertCreated()
        ->assertJsonPath('data.order.payment_status', 'paid');

    $customer = app(TenantManager::class)->runAs($tenant, fn () => Customer::first());
    $account = app(TenantManager::class)->runAs($tenant, fn () => LoyaltyAccount::first());

    // 100 × 0.1 = 10 points.
    expect($customer->name)->toBe('Ada')
        ->and($account->points_balance)->toBe(10);
});

it('reuses the same customer for the same phone and does not double-earn', function () {
    ['tenant' => $tenant, 'product' => $product, 'table' => $table] = loyaltyVenue();

    foreach ([1, 2] as $_) {
        $orderId = postJson("/v1/sessions/{$table->qr_token}/orders", [
            'items' => [['product_id' => $product->id, 'quantity' => 1]],
            'customer' => ['phone' => '+905331112233'],
        ])->json('data.id');
        postJson("/v1/sessions/{$table->qr_token}/orders/{$orderId}/pay", ['gateway' => 'cash'])->assertCreated();
        // Paying again must not re-earn.
        postJson("/v1/sessions/{$table->qr_token}/orders/{$orderId}/pay", ['gateway' => 'cash'])->assertStatus(422);
    }

    [$customerCount, $points] = app(TenantManager::class)->runAs($tenant, fn () => [
        Customer::count(),
        LoyaltyAccount::first()->points_balance,
    ]);

    expect($customerCount)->toBe(1)->and($points)->toBe(20); // two orders × 10
});

it('lists customers with masked phone and points for managers', function () {
    ['tenant' => $tenant, 'product' => $product, 'table' => $table] = loyaltyVenue();

    $orderId = postJson("/v1/sessions/{$table->qr_token}/orders", [
        'items' => [['product_id' => $product->id, 'quantity' => 1]],
        'customer' => ['phone' => '+905331112233', 'name' => 'Ada'],
    ])->json('data.id');
    postJson("/v1/sessions/{$table->qr_token}/orders/{$orderId}/pay", ['gateway' => 'cash']);

    Sanctum::actingAs(User::factory()->forTenant($tenant)->role(Role::Manager)->create());

    $res = getJson('/v1/admin/customers')->assertOk()
        ->assertJsonPath('data.0.name', 'Ada')
        ->assertJsonPath('data.0.points', 10);

    // Phone is masked, never returned in full.
    expect($res->json('data.0.phone_masked'))->toContain('•');
});
