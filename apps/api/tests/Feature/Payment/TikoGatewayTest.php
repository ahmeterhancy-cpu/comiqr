<?php

use App\Models\Branch;
use App\Models\Order;
use App\Models\Payment;
use App\Models\Tenant;
use App\Payments\TikoGateway;
use App\Support\Tenancy\TenantManager;
use Illuminate\Foundation\Testing\RefreshDatabase;

use function Pest\Laravel\post;
use function Pest\Laravel\postJson;

uses(RefreshDatabase::class);

const TIKO_CFG = ['merchant_id' => 'M1', 'secret' => 'sekret', 'password' => 'pass', 'currency' => 'TRY', 'is_test' => true];

function tikoGateway(): TikoGateway
{
    config(['payments.gateways.tiko' => TIKO_CFG]);

    return new TikoGateway(TIKO_CFG);
}

function tikoPayment(float $amount = 100): Payment
{
    $tenant = Tenant::factory()->create();

    return app(TenantManager::class)->runAs($tenant, function () use ($amount) {
        $branch = Branch::factory()->create();
        $order = Order::factory()->create(['branch_id' => $branch->id, 'subtotal' => $amount, 'grand_total' => $amount, 'payment_status' => 'unpaid']);

        return Payment::create(['order_id' => $order->id, 'gateway' => 'tiko', 'amount' => $amount, 'status' => 'initiated']);
    });
}

it('computes the documented HMAC-SHA256 + base64 hash', function () {
    $g = tikoGateway();
    $expected = base64_encode(hash_hmac('sha256', 'hello'.'pass', 'sekret', true));

    expect($g->hash('hello'))->toBe($expected);
});

it('builds a pay3d form session with a valid request hash', function () {
    $g = tikoGateway();
    $payment = tikoPayment(140);

    $session = $g->initiate($payment);

    expect($session->kind)->toBe('form');
    expect($session->url)->toEndWith('/gateway/pay3d');

    $f = $session->meta['fields'];
    expect($f['MerchantId'])->toBe('M1');
    expect($f['Amount'])->toBe('140.00');
    expect($f['Currency'])->toBe('TRY');
    expect($f['Installment'])->toBe('0');
    // No card data leaves our server.
    expect($f)->not->toHaveKeys(['CardNo', 'CardCvv']);

    // Recompute the request hash from the documented formula.
    $hashStr = $f['MerchantId'].$f['UserIp'].$f['OrderId'].$f['UrlOk'].$f['UrlFail'].$f['Amount'].$f['Currency'].$f['Installment'].$f['IsTest'];
    expect($f['Hash'])->toBe($g->hash($hashStr));

    // gateway_ref is persisted as OrderId for callback reconciliation.
    expect($payment->fresh()->gateway_ref)->toBe($f['OrderId']);
});

it('verifies a correctly-signed callback and rejects a tampered one', function () {
    $g = tikoGateway();
    $payload = ['MerchantId' => 'M1', 'OrderId' => 'TIKO1XABCDEF12', 'Amount' => '140.00', 'Currency' => 'TRY', 'Installment' => '0', 'TransId' => 'TX9', 'Status' => '200'];
    $payload['Hash'] = $g->hash($payload['MerchantId'].$payload['OrderId'].$payload['Amount'].$payload['Currency'].$payload['Installment'].$payload['TransId']);

    expect($g->verifyWebhook($payload))->toBeTrue();
    expect($g->isSuccessful($payload))->toBeTrue();

    // Amount tampered → hash no longer matches.
    expect($g->verifyWebhook([...$payload, 'Amount' => '1.00']))->toBeFalse();
    // Non-200 status is not a success.
    expect($g->isSuccessful([...$payload, 'Status' => '400']))->toBeFalse();
});

it('confirms the payment on a verified Tiko callback', function () {
    $g = tikoGateway();
    $payment = tikoPayment(100);
    $g->initiate($payment); // sets gateway_ref
    $ref = $payment->fresh()->gateway_ref;

    $payload = ['MerchantId' => 'M1', 'OrderId' => $ref, 'Amount' => '100.00', 'Currency' => 'TRY', 'Installment' => '0', 'TransId' => 'TX100', 'Status' => '200'];
    $payload['Hash'] = $g->hash($payload['MerchantId'].$ref.$payload['Amount'].$payload['Currency'].$payload['Installment'].$payload['TransId']);

    postJson('/v1/payments/webhook/tiko', $payload)->assertOk();

    expect($payment->fresh()->status)->toBe('paid');
    expect($payment->fresh()->order->payment_status)->toBe('paid');
});

it('confirms and redirects to the result page on a valid 3DS return', function () {
    $g = tikoGateway();
    config(['payments.result_url' => 'https://cust.example/order-result']);
    $payment = tikoPayment(100);
    $g->initiate($payment);
    $ref = $payment->fresh()->gateway_ref;

    $payload = ['MerchantId' => 'M1', 'OrderId' => $ref, 'Amount' => '100.00', 'Currency' => 'TRY', 'Installment' => '0', 'TransId' => 'TR1', 'Status' => '200'];
    $payload['Hash'] = $g->hash('M1'.$ref.'100.00'.'TRY'.'0'.'TR1');

    $res = post('/v1/payments/return/tiko', $payload);
    $res->assertRedirect();
    expect($res->headers->get('Location'))->toContain('status=paid');
    expect($payment->fresh()->status)->toBe('paid');
});

it('redirects with failed status on an invalid 3DS return', function () {
    tikoGateway();
    config(['payments.result_url' => 'https://cust.example/order-result']);

    $res = post('/v1/payments/return/tiko', ['OrderId' => 'X', 'Status' => '200', 'Hash' => 'forged']);
    $res->assertRedirect();
    expect($res->headers->get('Location'))->toContain('status=failed');
});

it('rejects a Tiko callback with an invalid signature (403)', function () {
    tikoGateway(); // configure credentials so the gateway can verify

    postJson('/v1/payments/webhook/tiko', [
        'MerchantId' => 'M1', 'OrderId' => 'TIKO404', 'Amount' => '100.00', 'Currency' => 'TRY',
        'Installment' => '0', 'TransId' => 'TX', 'Status' => '200', 'Hash' => 'forged',
    ])->assertStatus(403);
});
