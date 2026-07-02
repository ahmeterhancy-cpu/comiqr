<?php

use App\Enums\Role;
use App\Models\Plan;
use App\Models\Subscription;
use App\Models\Tenant;
use App\Models\User;
use App\Payments\TikoGateway;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Laravel\Sanctum\Sanctum;

use function Pest\Laravel\postJson;

uses(RefreshDatabase::class);

it('starts a Tiko recurring subscription for a tenant plan', function () {
    config(['payments.gateways.tiko' => ['merchant_id' => 'M1', 'secret' => 's', 'password' => 'p', 'currency' => 'TRY', 'base_url' => 'https://www.tikokart.com/api-sanalpos']]);
    Http::fake(['*recurring/create' => Http::response(['Status' => '200', 'Result' => ['Id' => 1042, 'PlanStatus' => 'Active', 'NextCollectionDate' => '2026-08-01T00:00:00']], 200)]);

    $plan = Plan::factory()->create(['code' => 'pro-sub', 'name' => 'Pro', 'price_monthly' => 990, 'currency' => 'TRY']);
    $tenant = Tenant::factory()->create();
    User::factory()->forTenant($tenant)->role(Role::Owner)->create(['name' => 'Ada Sahibi', 'phone' => '05301112233']);

    Sanctum::actingAs(User::factory()->superadmin()->create(['email' => 'sub-root@comiqr.com']));

    postJson("/v1/superadmin/tenants/{$tenant->id}/subscription", ['plan_id' => $plan->id, 'billing_cycle' => 'monthly'])
        ->assertOk()
        ->assertJsonPath('data.subscription.status', 'pending_authorization')
        ->assertJsonPath('data.subscription.gateway_ref', '1042');

    $tiko = new TikoGateway(config('payments.gateways.tiko'));
    Http::assertSent(fn ($r) => str_contains($r->url(), 'recurring/create')
        && $r['CustomerPhone'] === '05301112233'
        && (float) $r['Amount'] === 990.0
        && $r['Frequency'] === 'Monthly'
        && $r['Hash'] === $tiko->hash('M1'.'05301112233'.'990.00'.'TRY'));

    expect(Subscription::where('tenant_id', $tenant->id)->first()->gateway_ref)->toBe('1042');
});

it('rejects starting a subscription without an owner phone', function () {
    config(['payments.gateways.tiko' => ['merchant_id' => 'M1', 'secret' => 's', 'password' => 'p']]);
    Http::fake();

    $plan = Plan::factory()->create(['code' => 'pro-np', 'price_monthly' => 500]);
    $tenant = Tenant::factory()->create();
    User::factory()->forTenant($tenant)->role(Role::Owner)->create(['phone' => null]);

    Sanctum::actingAs(User::factory()->superadmin()->create(['email' => 'np-root@comiqr.com']));

    postJson("/v1/superadmin/tenants/{$tenant->id}/subscription", ['plan_id' => $plan->id])->assertStatus(422);
    Http::assertNothingSent();
});

it('rejects a zero-price plan for recurring', function () {
    config(['payments.gateways.tiko' => ['merchant_id' => 'M1', 'secret' => 's', 'password' => 'p']]);
    Http::fake();

    $plan = Plan::factory()->create(['code' => 'free-sub', 'price_monthly' => 0]);
    $tenant = Tenant::factory()->create();
    User::factory()->forTenant($tenant)->role(Role::Owner)->create(['phone' => '05300000000']);

    Sanctum::actingAs(User::factory()->superadmin()->create(['email' => 'z-root@comiqr.com']));

    postJson("/v1/superadmin/tenants/{$tenant->id}/subscription", ['plan_id' => $plan->id])->assertStatus(422);
    Http::assertNothingSent();
});
