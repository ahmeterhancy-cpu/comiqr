<?php

use App\Models\Category;
use App\Models\Customer;
use App\Models\Product;
use App\Models\SavedCard;
use App\Models\Tenant;
use App\Payments\TikoGateway;
use App\Support\Tenancy\TenantManager;
use Illuminate\Foundation\Testing\RefreshDatabase;

use function Pest\Laravel\getJson;
use function Pest\Laravel\post;
use function Pest\Laravel\postJson;

uses(RefreshDatabase::class);

function cardVenue(): array
{
    config(['payments.gateways.tiko' => ['merchant_id' => 'M1', 'secret' => 's', 'password' => 'p', 'currency' => 'TRY', 'base_url' => 'https://www.tikokart.com/api-sanalpos']]);

    $tenant = Tenant::factory()->create(['slug' => 'card-venue', 'status' => 'active']);

    return app(TenantManager::class)->runAs($tenant, function () use ($tenant) {
        \App\Models\Branch::factory()->create();
        $product = Product::factory()->forCategory(Category::factory()->create())->create(['price' => 120]);

        return compact('tenant', 'product');
    });
}

it('sends SaveCard fields when the customer opts to save the card', function () {
    ['product' => $product] = cardVenue();

    $res = postJson('/v1/venues/card-venue/orders', [
        'type' => 'delivery',
        'items' => [['product_id' => $product->id, 'quantity' => 1]],
        'contact' => ['name' => 'Ali', 'phone' => '05301112233', 'address' => 'X sok.'],
        'payment_method' => 'online',
        'save_card' => true,
    ])->assertCreated();

    $fields = $res->json('data.session.meta.fields');
    expect($fields['SaveCard'])->toBe('true');
    expect($fields['CardGroupKey'])->toBe('05301112233');
    expect($fields)->toHaveKey('Alias');
});

it('stores the CardId returned on a successful 3DS return', function () {
    config(['payments.result_url' => 'https://cust.example/result']);
    ['product' => $product] = cardVenue();

    $fields = postJson('/v1/venues/card-venue/orders', [
        'type' => 'takeaway',
        'items' => [['product_id' => $product->id, 'quantity' => 1]],
        'contact' => ['name' => 'Ali', 'phone' => '05301112233'],
        'payment_method' => 'online',
        'save_card' => true,
    ])->json('data.session.meta.fields');

    $g = new TikoGateway(config('payments.gateways.tiko'));
    $ref = $fields['OrderId'];
    $payload = ['MerchantId' => 'M1', 'OrderId' => $ref, 'Amount' => $fields['Amount'], 'Currency' => 'TRY', 'Installment' => '0', 'TransId' => 'T1', 'Status' => '200', 'CardId' => 'CARD_XYZ', 'Alias' => 'Kartım'];
    $payload['Hash'] = $g->hash('M1'.$ref.$fields['Amount'].'TRY'.'0'.'T1');

    post('/v1/payments/return/tiko', $payload)->assertRedirect();

    $customer = Customer::where('phone_hash', Customer::hashPhone('05301112233'))->first();
    expect(SavedCard::where('customer_id', $customer->id)->where('tiko_card_id', 'CARD_XYZ')->exists())->toBeTrue();
});

it('lists saved cards by phone without exposing the token', function () {
    ['tenant' => $tenant] = cardVenue();

    app(TenantManager::class)->runAs($tenant, function () {
        $c = Customer::factory()->create(['phone' => '05309998877', 'phone_hash' => Customer::hashPhone('05309998877')]);
        SavedCard::create(['customer_id' => $c->id, 'tiko_card_id' => 'TOK_SECRET', 'alias' => 'Kartım', 'last4' => '1234']);
    });

    $data = getJson('/v1/venues/card-venue/cards?phone=05309998877')->assertOk()->json('data');

    expect($data)->toHaveCount(1);
    expect($data[0]['alias'])->toBe('Kartım');
    expect($data[0]['last4'])->toBe('1234');
    expect(json_encode($data))->not->toContain('TOK_SECRET');
});

it('pays with a saved card — CardId in the hash, no card fields collected', function () {
    ['tenant' => $tenant, 'product' => $product] = cardVenue();

    $card = app(TenantManager::class)->runAs($tenant, function () {
        $c = Customer::factory()->create(['phone' => '05301112233', 'phone_hash' => Customer::hashPhone('05301112233')]);

        return SavedCard::create(['customer_id' => $c->id, 'tiko_card_id' => 'SAVED9', 'alias' => 'Kartım']);
    });

    $res = postJson('/v1/venues/card-venue/orders', [
        'type' => 'takeaway',
        'items' => [['product_id' => $product->id, 'quantity' => 1]],
        'contact' => ['name' => 'Ali', 'phone' => '05301112233'],
        'payment_method' => 'online',
        'saved_card_id' => $card->id,
    ])->assertCreated();

    $fields = $res->json('data.session.meta.fields');
    expect($fields['CardId'])->toBe('SAVED9');
    expect($fields)->not->toHaveKeys(['CardNo', 'SaveCard']);

    $g = new TikoGateway(config('payments.gateways.tiko'));
    $expected = $g->hash($fields['MerchantId'].$fields['UserIp'].$fields['OrderId'].$fields['UrlOk'].$fields['UrlFail'].$fields['Amount'].$fields['Currency'].$fields['Installment'].$fields['IsTest'].'SAVED9');
    expect($fields['Hash'])->toBe($expected);
});
