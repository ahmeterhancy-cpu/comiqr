<?php

use App\Enums\Role;
use App\Models\Account;
use App\Models\Tenant;
use App\Models\User;
use App\Services\AccountLedger;
use App\Support\Tenancy\TenantManager;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Validation\ValidationException;
use Laravel\Sanctum\Sanctum;

use function Pest\Laravel\deleteJson;
use function Pest\Laravel\getJson;
use function Pest\Laravel\postJson;

uses(RefreshDatabase::class);

function ledgerTenant(): Tenant
{
    $tenant = Tenant::factory()->create();
    Sanctum::actingAs(User::factory()->forTenant($tenant)->role(Role::Manager)->create());

    return $tenant;
}

it('starts an account at its opening balance and moves it with the ledger', function () {
    ledgerTenant();

    $id = postJson('/v1/admin/accounts', [
        'name' => 'Ali Usta',
        'type' => 'customer',
        'opening_balance' => 250,
    ])->assertCreated()->json('data.id');

    expect((float) Account::findOrFail($id)->balance)->toBe(250.0);

    // Veresiye satış (+) → borcu büyür.
    postJson("/v1/admin/accounts/{$id}/transactions", [
        'direction' => 'charge', 'amount' => 100,
    ])->assertCreated()->assertJsonPath('meta.balance', 350);

    // Tahsilat (−) → borcu küçülür.
    postJson("/v1/admin/accounts/{$id}/transactions", [
        'direction' => 'collect', 'amount' => 200, 'method' => 'cash',
    ])->assertCreated()->assertJsonPath('meta.balance', 150);

    getJson("/v1/admin/accounts/{$id}/transactions")
        ->assertOk()
        ->assertJsonPath('meta.balance', 150)
        ->assertJsonCount(2, 'data.data');
});

it('refuses a charge that would break the veresiye ceiling', function () {
    ledgerTenant();

    $id = postJson('/v1/admin/accounts', [
        'name' => 'Limitli Müşteri', 'type' => 'customer', 'credit_limit' => 500,
    ])->assertCreated()->json('data.id');

    postJson("/v1/admin/accounts/{$id}/transactions", ['direction' => 'charge', 'amount' => 400])
        ->assertCreated();

    postJson("/v1/admin/accounts/{$id}/transactions", ['direction' => 'charge', 'amount' => 200])
        ->assertStatus(422)->assertJsonValidationErrors('amount');

    // Reddedilen hareket bakiyeyi kıpırdatmamalı.
    expect((float) Account::findOrFail($id)->balance)->toBe(400.0);
});

it('lets a payment go through even when the account sits over its limit', function () {
    $tenant = ledgerTenant();

    app(TenantManager::class)->runAs($tenant, function () {
        $account = Account::factory()->withLimit(100)->create(['balance' => 500, 'opening_balance' => 500]);
        $ledger = app(AccountLedger::class);

        // Tavan yalnızca borcu büyüten yönü kapatır; tahsilat her zaman serbest.
        $ledger->collect($account, 300);
        expect((float) $account->fresh()->balance)->toBe(200.0);

        expect(fn () => $ledger->charge($account, 10))->toThrow(ValidationException::class);
    });
});

it('re-derives the cached balance from the ledger', function () {
    $tenant = ledgerTenant();

    app(TenantManager::class)->runAs($tenant, function () {
        $account = Account::factory()->create(['opening_balance' => 100, 'balance' => 100]);
        $ledger = app(AccountLedger::class);
        $ledger->charge($account, 50);
        $ledger->collect($account, 20);

        // Bakiye bozulsa bile defterden yeniden kurulabilir.
        $account->update(['balance' => 9999]);

        expect($ledger->recalculate($account->fresh()))->toBe(130.0);
    });
});

it('will not delete an account that still owes or is owed money', function () {
    ledgerTenant();

    $id = postJson('/v1/admin/accounts', [
        'name' => 'Açık Cari', 'type' => 'supplier', 'opening_balance' => -300,
    ])->assertCreated()->json('data.id');

    deleteJson("/v1/admin/accounts/{$id}")->assertStatus(422);

    postJson("/v1/admin/accounts/{$id}/transactions", ['direction' => 'settle', 'amount' => 300])
        ->assertCreated()->assertJsonPath('meta.balance', 0);

    deleteJson("/v1/admin/accounts/{$id}")->assertOk();
});

it('keeps accounts and their ledgers inside the tenant', function () {
    $other = Tenant::factory()->create();
    $foreign = app(TenantManager::class)->runAs($other, fn () => Account::factory()->create(['balance' => 100]));

    ledgerTenant();

    getJson('/v1/admin/accounts')->assertOk()->assertJsonCount(0, 'data');
    getJson("/v1/admin/accounts/{$foreign->id}")->assertNotFound();
    getJson("/v1/admin/accounts/{$foreign->id}/transactions")->assertNotFound();
    postJson("/v1/admin/accounts/{$foreign->id}/transactions", ['direction' => 'collect', 'amount' => 5])
        ->assertNotFound();

    expect((float) $foreign->fresh()->balance)->toBe(100.0);
});

it('summarises receivables and payables for the report', function () {
    $tenant = ledgerTenant();

    app(TenantManager::class)->runAs($tenant, function () {
        Account::factory()->customer()->create(['name' => 'Borçlu', 'balance' => 750, 'opening_balance' => 750]);
        Account::factory()->create(['name' => 'Tedarikçi', 'balance' => -1200, 'opening_balance' => -1200]);
    });

    getJson('/v1/admin/reports/accounts')
        ->assertOk()
        ->assertJsonPath('data.receivable_total', 750)
        ->assertJsonPath('data.payable_total', 1200)
        ->assertJsonPath('data.receivable.0.name', 'Borçlu')
        ->assertJsonPath('data.payable.0.name', 'Tedarikçi');
});
