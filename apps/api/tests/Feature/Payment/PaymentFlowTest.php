<?php

use App\Models\Branch;
use App\Models\Category;
use App\Models\Product;
use App\Models\Table;
use App\Models\TableSession;
use App\Models\Tenant;
use App\Services\OrderService;
use App\Support\Tenancy\TenantManager;
use Illuminate\Foundation\Testing\RefreshDatabase;

use function Pest\Laravel\postJson;

uses(RefreshDatabase::class);

function payableOrder(float $price = 100): array
{
    $tenant = Tenant::factory()->create();

    return app(TenantManager::class)->runAs($tenant, function () use ($tenant, $price) {
        $branch = Branch::factory()->create();
        $category = Category::factory()->create();
        $product = Product::factory()->forCategory($category)->create(['price' => $price]);
        $table = Table::factory()->forBranch($branch)->create();
        $session = TableSession::create(['table_id' => $table->id, 'status' => 'open', 'opened_at' => now()]);
        $order = app(OrderService::class)->place($table, $session, [['product_id' => $product->id, 'quantity' => 1]]);

        return compact('tenant', 'table', 'order');
    });
}

it('pays with cash immediately (completed)', function () {
    ['table' => $table, 'order' => $order] = payableOrder(100);

    postJson("/v1/sessions/{$table->qr_token}/orders/{$order->id}/pay", ['gateway' => 'cash'])
        ->assertCreated()
        ->assertJsonPath('data.session.kind', 'completed')
        ->assertJsonPath('data.payment.status', 'paid')
        ->assertJsonPath('data.order.payment_status', 'paid');
});

it('adds a tip to the order total when paying', function () {
    ['table' => $table, 'order' => $order] = payableOrder(100);

    postJson("/v1/sessions/{$table->qr_token}/orders/{$order->id}/pay", ['gateway' => 'cash', 'tip' => 15])
        ->assertCreated()
        ->assertJsonPath('data.order.grand_total', '115.00')
        ->assertJsonPath('data.order.tip_total', '15.00');
});

it('rejects paying an already-paid order', function () {
    ['table' => $table, 'order' => $order] = payableOrder(100);

    postJson("/v1/sessions/{$table->qr_token}/orders/{$order->id}/pay", ['gateway' => 'cash'])->assertCreated();
    postJson("/v1/sessions/{$table->qr_token}/orders/{$order->id}/pay", ['gateway' => 'cash'])->assertStatus(422);
});

it('splits a bill across partial payments', function () {
    ['table' => $table, 'order' => $order] = payableOrder(100);

    postJson("/v1/sessions/{$table->qr_token}/orders/{$order->id}/pay", ['gateway' => 'cash', 'amount' => 50])
        ->assertCreated()
        ->assertJsonPath('data.order.payment_status', 'partially_paid');

    postJson("/v1/sessions/{$table->qr_token}/orders/{$order->id}/pay", ['gateway' => 'cash', 'amount' => 50])
        ->assertCreated()
        ->assertJsonPath('data.order.payment_status', 'paid');
});
