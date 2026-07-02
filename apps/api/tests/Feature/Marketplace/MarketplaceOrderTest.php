<?php

use App\Models\Category;
use App\Models\Product;
use App\Models\Tenant;
use App\Support\Tenancy\TenantManager;
use Illuminate\Foundation\Testing\RefreshDatabase;

use function Pest\Laravel\postJson;

uses(RefreshDatabase::class);

function marketplaceVenue(): array
{
    $tenant = Tenant::factory()->create(['slug' => 'girne-meze', 'status' => 'active']);

    return app(TenantManager::class)->runAs($tenant, function () use ($tenant) {
        \App\Models\Branch::factory()->create();
        $product = Product::factory()->forCategory(Category::factory()->create())->create(['price' => 100]);

        return compact('tenant', 'product');
    });
}

it('places a delivery order paid at the door (cod)', function () {
    ['product' => $product] = marketplaceVenue();

    postJson('/v1/venues/girne-meze/orders', [
        'type' => 'delivery',
        'items' => [['product_id' => $product->id, 'quantity' => 2]],
        'contact' => ['name' => 'Ali', 'phone' => '05301112233', 'address' => 'Sahil Cad. 5'],
        'payment_method' => 'cod',
    ])
        ->assertCreated()
        ->assertJsonPath('data.order.type', 'delivery')
        ->assertJsonPath('data.order.address', 'Sahil Cad. 5')
        ->assertJsonPath('data.order.contact_phone', '05301112233')
        ->assertJsonPath('data.order.payment_status', 'unpaid')
        ->assertJsonPath('data.order.grand_total', '200.00')
        ->assertJsonPath('data.payment_method', 'cod')
        ->assertJsonPath('data.session', null);
});

it('places a takeaway order without an address', function () {
    ['product' => $product] = marketplaceVenue();

    postJson('/v1/venues/girne-meze/orders', [
        'type' => 'takeaway',
        'items' => [['product_id' => $product->id, 'quantity' => 1]],
        'contact' => ['name' => 'Veli', 'phone' => '05300000000'],
        'payment_method' => 'cod',
    ])
        ->assertCreated()
        ->assertJsonPath('data.order.type', 'takeaway')
        ->assertJsonPath('data.order.address', null);
});

it('requires an address for delivery', function () {
    ['product' => $product] = marketplaceVenue();

    postJson('/v1/venues/girne-meze/orders', [
        'type' => 'delivery',
        'items' => [['product_id' => $product->id, 'quantity' => 1]],
        'contact' => ['name' => 'Ali', 'phone' => '05300000000'],
        'payment_method' => 'cod',
    ])->assertStatus(422)->assertJsonValidationErrorFor('contact.address');
});

it('returns a Tiko form session for online payment', function () {
    config([
        'payments.gateways.tiko' => ['merchant_id' => 'M1', 'secret' => 's', 'password' => 'p', 'currency' => 'TRY', 'base_url' => 'https://www.tikokart.com/api-sanalpos'],
    ]);
    ['product' => $product] = marketplaceVenue();

    postJson('/v1/venues/girne-meze/orders', [
        'type' => 'delivery',
        'items' => [['product_id' => $product->id, 'quantity' => 1]],
        'contact' => ['name' => 'Ali', 'phone' => '05300000000', 'address' => 'X sok.'],
        'payment_method' => 'online',
    ])
        ->assertCreated()
        ->assertJsonPath('data.payment_method', 'online')
        ->assertJsonPath('data.session.kind', 'form')
        ->assertJsonPath('data.session.url', 'https://www.tikokart.com/api-sanalpos/gateway/pay3d');
});

it('404s for an unknown venue', function () {
    postJson('/v1/venues/yok/orders', [
        'type' => 'takeaway',
        'items' => [['product_id' => 1, 'quantity' => 1]],
        'contact' => ['name' => 'A', 'phone' => '0'],
        'payment_method' => 'cod',
    ])->assertNotFound();
});
