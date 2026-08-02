<?php

use App\Enums\Role;
use App\Models\Account;
use App\Models\Branch;
use App\Models\Category;
use App\Models\Customer;
use App\Models\Order;
use App\Models\Payment;
use App\Models\Product;
use App\Models\Table;
use App\Models\Tenant;
use App\Models\User;
use App\Support\Tenancy\TenantManager;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;

use function Pest\Laravel\postJson;

uses(RefreshDatabase::class);

/** A venue with one 100 TL product, plus a cashier signed in. */
function veresiyeVenue(): array
{
    $tenant = Tenant::factory()->create();

    $ctx = app(TenantManager::class)->runAs($tenant, function () use ($tenant) {
        Branch::factory()->create();
        $product = Product::factory()->forCategory(Category::factory()->create())->create(['price' => 100]);
        $table = Table::factory()->create(['code' => 'M1']);
        $account = Account::factory()->customer()->create(['name' => 'Mahalleli Ahmet']);

        return compact('tenant', 'product', 'table', 'account');
    });

    Sanctum::actingAs(User::factory()->forTenant($tenant)->role(Role::Cashier)->create());

    return $ctx;
}

function veresiyeOrder(int $productId, int $tableId, int $qty = 2): int
{
    return postJson('/v1/admin/pos/orders', [
        'table_id' => $tableId,
        'items' => [['product_id' => $productId, 'quantity' => $qty]],
    ])->assertCreated()->json('data.id');
}

it('settles an order onto a current account and leaves the drawer alone', function () {
    ['tenant' => $tenant, 'product' => $product, 'table' => $table, 'account' => $account] = veresiyeVenue();
    $orderId = veresiyeOrder($product->id, $table->id);

    postJson("/v1/admin/pos/orders/{$orderId}/charge-account", ['account_id' => $account->id])
        ->assertOk()
        ->assertJsonPath('data.payment_status', 'paid')
        ->assertJsonPath('meta.charged', 200)
        ->assertJsonPath('meta.account.balance', 200)
        ->assertJsonPath('meta.outstanding', 0);

    expect((float) $account->fresh()->balance)->toBe(200.0);

    app(TenantManager::class)->runAs($tenant, function () use ($orderId) {
        $payments = Payment::where('order_id', $orderId)->get();
        expect($payments)->toHaveCount(1);
        // Veresiye ne kasayı ne POS'u görür — kendi tender'ı.
        expect($payments->first()->gateway)->toBe('credit');
        expect(Payment::where('order_id', $orderId)->whereIn('gateway', ['cash', 'card'])->count())->toBe(0);
    });
});

it('splits a bill between cash and the tab', function () {
    ['product' => $product, 'table' => $table, 'account' => $account] = veresiyeVenue();
    $orderId = veresiyeOrder($product->id, $table->id);

    postJson("/v1/admin/pos/orders/{$orderId}/pay", ['gateway' => 'cash', 'amount' => 80])->assertOk();

    postJson("/v1/admin/pos/orders/{$orderId}/charge-account", ['account_id' => $account->id])
        ->assertOk()
        ->assertJsonPath('meta.charged', 120)
        ->assertJsonPath('data.payment_status', 'paid');

    expect((float) $account->fresh()->balance)->toBe(120.0);
});

it('rolls the whole sale back when the account is over its credit ceiling', function () {
    ['tenant' => $tenant, 'product' => $product, 'table' => $table, 'account' => $account] = veresiyeVenue();
    $account->update(['credit_limit' => 150]);

    $orderId = veresiyeOrder($product->id, $table->id); // 200 TL

    postJson("/v1/admin/pos/orders/{$orderId}/charge-account", ['account_id' => $account->id])
        ->assertStatus(422)->assertJsonValidationErrors('amount');

    expect((float) $account->fresh()->balance)->toBe(0.0);

    app(TenantManager::class)->runAs($tenant, function () use ($orderId) {
        // Ne ödeme satırı ne de borç kaldı — sipariş hâlâ açık.
        expect(Payment::where('order_id', $orderId)->count())->toBe(0);
        expect(Order::findOrFail($orderId)->payment_status)->toBe('unpaid');
    });
});

it('links the sale to the CRM card behind the account', function () {
    ['tenant' => $tenant, 'product' => $product, 'table' => $table, 'account' => $account] = veresiyeVenue();

    $customer = app(TenantManager::class)->runAs($tenant, fn () => Customer::factory()->create());
    $account->update(['customer_id' => $customer->id]);

    $orderId = veresiyeOrder($product->id, $table->id);
    postJson("/v1/admin/pos/orders/{$orderId}/charge-account", ['account_id' => $account->id])->assertOk();

    app(TenantManager::class)->runAs($tenant, function () use ($orderId, $customer) {
        expect(Order::findOrFail($orderId)->customer_id)->toBe($customer->id);
    });
});

it('refuses an account from another tenant and an already-paid order', function () {
    ['product' => $product, 'table' => $table, 'account' => $account] = veresiyeVenue();

    $foreign = app(TenantManager::class)->runAs(
        Tenant::factory()->create(),
        fn () => Account::factory()->create(),
    );

    $orderId = veresiyeOrder($product->id, $table->id);
    postJson("/v1/admin/pos/orders/{$orderId}/charge-account", ['account_id' => $foreign->id])
        ->assertStatus(422)->assertJsonValidationErrors('account_id');

    postJson("/v1/admin/pos/orders/{$orderId}/pay", ['gateway' => 'cash'])->assertOk();
    postJson("/v1/admin/pos/orders/{$orderId}/charge-account", ['account_id' => $account->id])
        ->assertStatus(422);
});
